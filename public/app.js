const list = document.getElementById('news-list');
const dateEl = document.getElementById('date');
const refreshBtn = document.getElementById('refresh-btn');
const speakBtn = document.getElementById('speak-btn');

let currentArticles = [];
let speaking = false;

function formatDate() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
}

function timeAgo(published) {
  if (!published) return '';
  const diff = Math.floor((Date.now() - new Date(published)) / 60000);
  if (diff < 60) return `${diff}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}

function renderCard(article, i) {
  const card = document.createElement('article');
  card.className = 'news-card';
  card.id = `card-${i}`;
  card.style.animationDelay = `${i * 100}ms`;

  const bullets = (article.bullets ?? []).map(b => `<li>${b}</li>`).join('');

  card.innerHTML = `
    <div class="news-number">${i + 1}</div>
    <div class="news-body">
      <div class="news-title">${article.title ?? '제목 없음'}</div>
      <ul class="news-bullets">${bullets}</ul>
      <div class="news-meta">
        <span class="news-source">${article.source ?? ''}</span>
        <span>${timeAgo(article.publishedAt)}</span>
      </div>
    </div>`;
  return card;
}

function showError(msg) {
  list.innerHTML = `<div class="error-msg"><strong>뉴스를 불러오지 못했어요</strong>${msg}</div>`;
}

function stopSpeech() {
  speechSynthesis.cancel();
  speaking = false;
  speakBtn.textContent = '▶ 읽어주기';
  document.querySelectorAll('.news-card').forEach(c => c.classList.remove('speaking'));
}

function speakAll() {
  if (speaking) { stopSpeech(); return; }
  if (!currentArticles.length) return;

  speechSynthesis.cancel();
  speaking = true;
  speakBtn.textContent = '■ 멈추기';

  const scripts = currentArticles.map((a, i) => ({
    text: `${i + 1}번 뉴스. ${a.title}. ${(a.bullets ?? []).join('. ')}`,
    index: i,
  }));

  let idx = 0;

  function next() {
    if (idx >= scripts.length || !speaking) { stopSpeech(); return; }

    document.querySelectorAll('.news-card').forEach(c => c.classList.remove('speaking'));
    const card = document.getElementById(`card-${scripts[idx].index}`);
    if (card) {
      card.classList.add('speaking');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const utter = new SpeechSynthesisUtterance(scripts[idx].text);
    utter.lang = 'ko-KR';
    utter.rate = 1.0;
    utter.onend = () => { idx++; next(); };
    utter.onerror = () => { idx++; next(); };
    speechSynthesis.speak(utter);
  }

  next();
}

async function loadNews() {
  stopSpeech();
  dateEl.textContent = formatDate();
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  refreshBtn.disabled = true;
  speakBtn.disabled = true;

  try {
    const res = await fetch('/api/news');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    if (!data.articles.length) throw new Error('검색된 뉴스가 없습니다.');

    currentArticles = data.articles;
    list.innerHTML = '';
    data.articles.forEach((a, i) => list.appendChild(renderCard(a, i)));
    speakBtn.disabled = false;

    // 진입 시 자동 읽기
    speakAll();
  } catch (err) {
    showError(err.message);
  } finally {
    refreshBtn.disabled = false;
  }
}

speakBtn.addEventListener('click', speakAll);
refreshBtn.addEventListener('click', loadNews);
loadNews();
