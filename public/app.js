const list = document.getElementById('news-list');
const dateEl = document.getElementById('date');
const refreshBtn = document.getElementById('refresh-btn');

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

async function loadNews() {
  dateEl.textContent = formatDate();
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  refreshBtn.disabled = true;

  try {
    const res = await fetch('/api/news');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    if (!data.articles.length) throw new Error('검색된 뉴스가 없습니다.');

    list.innerHTML = '';
    data.articles.forEach((a, i) => list.appendChild(renderCard(a, i)));
  } catch (err) {
    showError(err.message);
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', loadNews);
loadNews();
