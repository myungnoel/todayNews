import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { Agent } from 'node:https';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

const isLocal = process.env.NODE_ENV !== 'production';
const httpsAgent = isLocal ? new Agent({ rejectUnauthorized: false }) : undefined;

app.use(express.static(join(__dirname, 'public')));

let cache = { date: null, articles: [] };

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim();
}

async function summarize(title, description) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    ...(httpsAgent && { agent: httpsAgent }),
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: '너는 한국 뉴스 요약 전문가야. 반드시 JSON 배열만 출력해. 다른 텍스트는 절대 포함하지 마.'
        },
        {
          role: 'user',
          content: `다음 뉴스를 핵심만 담아 정확히 3줄로 요약해줘.
각 줄은 35자 이내 한 문장. 반드시 아래 형식으로만 답해:
["첫째 줄","둘째 줄","셋째 줄"]

제목: ${title}
내용: ${description}`
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
    return [title];
  }
}

async function fetchTopNews() {
  const today = new Date().toISOString().slice(0, 10);
  if (cache.date === today && cache.articles.length > 0) return cache.articles;

  const queries = ['정치', '경제', '사회'];
  const seen = new Set();
  const items = [];

  for (const q of queries) {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=3&sort=date`;
    const res = await fetch(url, {
      ...(httpsAgent && { agent: httpsAgent }),
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      }
    });
    const data = await res.json();
    for (const item of (data.items ?? [])) {
      const title = stripHtml(item.title);
      if (!seen.has(title)) {
        seen.add(title);
        items.push({ title, description: stripHtml(item.description) });
        break;
      }
    }
  }

  const articles = await Promise.all(
    items.map(async ({ title, description }) => ({
      title,
      source: '',
      publishedAt: new Date().toISOString(),
      bullets: await summarize(title, description),
    }))
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
