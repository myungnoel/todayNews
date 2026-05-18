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

async function summarize(title, description) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    agent: httpsAgent,
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `다음 뉴스를 핵심만 담아 정확히 3줄로 요약해줘.
- 각 줄은 한 문장, 40자 이내
- 육하원칙 기반으로 사실만
- JSON 배열로만 응답: ["줄1","줄2","줄3"]

제목: ${title}
내용: ${description ?? '없음'}`
      }]
    })
  });

  const data = await res.json();
  try {
    const text = data.choices[0].message.content.trim();
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match[0]);
  } catch {
    return [title];
  }
}

async function fetchTopNews() {
  const today = new Date().toISOString().slice(0, 10);
  if (cache.date === today && cache.articles.length > 0) return cache.articles;

  const feed = await rss.parseURL('https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko');
  const items = feed.items.slice(0, 3);

  const articles = await Promise.all(
    items.map(async (item) => {
      const title = item.title?.replace(/ - [^-]+$/, '') ?? '';
      return {
        title,
        source: item.source ?? '',
        publishedAt: item.pubDate ?? '',
        bullets: await summarize(title, item.contentSnippet),
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
