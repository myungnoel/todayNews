import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { Agent } from 'node:https';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Parser from 'rss-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const httpsAgent = new Agent({ rejectUnauthorized: false });
const rss = new Parser();

app.use(express.static(join(__dirname, 'public')));

let cache = { date: null, articles: [] };

async function summarize(title) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    agent: httpsAgent,
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: '너는 한국 뉴스 요약 전문가야. 반드시 JSON 배열만 출력해. 다른 텍스트는 절대 포함하지 마.'
        },
        {
          role: 'user',
          content: `뉴스 제목을 보고 이 뉴스의 핵심 내용을 3줄로 추론해서 요약해줘.
각 줄은 35자 이내 한 문장. 반드시 아래 형식으로만 답해:
["첫째 줄","둘째 줄","셋째 줄"]

제목: ${title}`
        }
      ]
    })
  });

  const data = await res.json();
  try {
    const text = data.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.length >= 2) return parsed.slice(0, 3);
    throw new Error('invalid');
  } catch {
    // 파싱 실패 시 제목을 3등분해서 표시
    const words = title.split(' ');
    const mid = Math.ceil(words.length / 2);
    return [
      words.slice(0, mid).join(' '),
      words.slice(mid).join(' '),
      '자세한 내용은 원문을 참고하세요.',
    ];
  }
}

async function fetchTopNews() {
  const today = new Date().toISOString().slice(0, 10);
  if (cache.date === today && cache.articles.length > 0) return cache.articles;

  const feed = await rss.parseURL('https://news.google.com/rss/headlines/section/topic/NATION?hl=ko&gl=KR&ceid=KR:ko');
  const items = feed.items.slice(0, 3);

  const articles = await Promise.all(
    items.map(async (item) => {
      const title = item.title?.replace(/ - [^-]+$/, '') ?? '';
      return {
        title,
        source: item.source ?? '',
        publishedAt: item.pubDate ?? '',
        bullets: await summarize(title),
      };
    })
  );

  cache = { date: today, articles };
  return articles;
}

app.get('/api/news', async (_req, res) => {
  try {
    const articles = await fetchTopNews();
    res.json({ ok: true, articles });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

export default app;
