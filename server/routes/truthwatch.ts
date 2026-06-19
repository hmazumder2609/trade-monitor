/**
 * TruthWatch API — TruthSocial (Trump) feed monitor.
 * Tracks Trump's posts, extracts tickers, classifies topics, measures market impact.
 * Uses public TruthSocial API — no auth key needed.
 */
import type { IncomingHttpHeaders } from 'node:http';
import { extractTickers, analyzeSentiment } from '../utils/sentiment-analyzer';
import { storePanelResults, type PanelMention } from '../utils/signal-correlator';

const FETCH_TIMEOUT = 8000;
const DEFAULT_ACCOUNT_ID = process.env.TRUTH_SOCIAL_ACCOUNT_ID || '107966320926216192';
const TRUTH_API_BASE = 'https://truthsocial.com/api/v1';

const SECTOR_KEYWORDS: Record<string, RegExp> = {
  tariffs: /\b(tariff|trade war|china tariff|import tax|reciprocal)\b/i,
  crypto: /\b(crypto|bitcoin|btc|ethereum|defi|digital asset|blockchain)\b/i,
  ai: /\b(ai|artificial intelligence|deepseek|openai|chatgpt|llm)\b/i,
  fed: /\b(fed|interest rate|rate cut|inflation|cpi|powell|monetary policy)\b/i,
  china: /\b(china|beijing|xi|taiwan|chinese|trade deficit)\b/i,
  energy: /\b(oil|gas|energy|drill|fossil fuel|green energy|gasoline)\b/i,
  stocks: /\b(stock market|dow|s&p|nasdaq|record high|rally|bull market)\b/i,
};

export interface TruthPost {
  id: string;
  text: string;
  created_at: string;
  url: string;
  favorites_count: number;
  reblogs_count: number;
  tickers: string[];
  sentiment: { positive: number; negative: number; score: number };
  topics: string[];
  sector: string;
}

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 3 * 60_000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data as T);
  return fn().then(data => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

function detectTopics(text: string): string[] {
  const topics: string[] = [];
  for (const [sector, pattern] of Object.entries(SECTOR_KEYWORDS)) {
    if (pattern.test(text)) topics.push(sector);
  }
  return topics;
}

function detectSector(topics: string[]): string {
  if (topics.length === 0) return 'general';
  const priority = ['tariffs', 'crypto', 'ai', 'fed', 'china', 'energy', 'stocks'];
  for (const s of priority) {
    if (topics.includes(s)) return s;
  }
  return topics[0];
}

async function fetchStatuses(accountId: string): Promise<TruthPost[]> {
  return cached(`truthwatch-${accountId}`, async () => {
    const resp = await fetch(
      `${TRUTH_API_BASE}/accounts/${accountId}/statuses?limit=20&exclude_replies=true&exclude_reblogs=true`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
    );
    if (!resp.ok) throw new Error(`TruthSocial ${resp.status}`);

    const data = (await resp.json()) as any[];
    return data.map((s: any): TruthPost => {
      const text = s.content?.replace(/<[^>]*>/g, '') || '';
      const tickers = extractTickers(text);
      const sentiment = analyzeSentiment(text);
      const topics = detectTopics(text);
      return {
        id: s.id,
        text: text.slice(0, 1000),
        created_at: s.created_at || '',
        url: s.url || `https://truthsocial.com/@realDonaldTrump/${s.id}`,
        favorites_count: s.favourites_count || 0,
        reblogs_count: s.reblogs_count || 0,
        tickers: [...new Set(tickers)],
        sentiment,
        topics,
        sector: detectSector(topics),
      };
    });
  });
}

function aggregateMentions(posts: TruthPost[]): PanelMention[] {
  const map = new Map<string, { count: number; sentiment: number }>();
  for (const post of posts) {
    for (const sym of post.tickers) {
      if (!map.has(sym)) map.set(sym, { count: 0, sentiment: 0 });
      const entry = map.get(sym)!;
      entry.count++;
      entry.sentiment += post.sentiment.score;
    }
  }

  return [...map.entries()]
    .map(([symbol, data]) => ({
      symbol,
      source: 'truth' as const,
      count: data.count,
      sentiment: Number((data.sentiment / data.count).toFixed(3)),
    }))
    .sort((a, b) => b.count - a.count);
}

function aggregateBySector(
  posts: TruthPost[]
): Record<string, { count: number; avgSentiment: number }> {
  const sectors: Record<string, { count: number; sentiments: number[] }> = {};
  for (const post of posts) {
    const sector = post.sector || 'general';
    if (!sectors[sector]) sectors[sector] = { count: 0, sentiments: [] };
    sectors[sector].count++;
    sectors[sector].sentiments.push(post.sentiment.score);
  }

  const result: Record<string, { count: number; avgSentiment: number }> = {};
  for (const [sector, data] of Object.entries(sectors)) {
    result[sector] = {
      count: data.count,
      avgSentiment:
        data.sentiments.length > 0
          ? Number((data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length).toFixed(3))
          : 0,
    };
  }
  return result;
}

// ============ Demo data ============
const DEMO_POSTS: TruthPost[] = [
  {
    id: '1',
    text: 'We are going to impose reciprocal tariffs on China. They have taken advantage of us for too long. America First! 🇺🇸',
    created_at: new Date().toISOString(),
    url: '',
    favorites_count: 45231,
    reblogs_count: 8921,
    tickers: [],
    sentiment: { positive: 1, negative: 0, score: 1 },
    topics: ['tariffs', 'china'],
    sector: 'tariffs',
  },
  {
    id: '2',
    text: 'Crypto is the future. Bitcoin and other digital assets are going to be HUGE. I am very positive on crypto, just like I always was!',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    url: '',
    favorites_count: 38450,
    reblogs_count: 7210,
    tickers: ['BTC'],
    sentiment: { positive: 2, negative: 0, score: 1 },
    topics: ['crypto'],
    sector: 'crypto',
  },
  {
    id: '3',
    text: 'The Fed has to cut interest rates. Inflation is coming down nicely. Do not let the radical left destroy our economy!',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    url: '',
    favorites_count: 31200,
    reblogs_count: 5400,
    tickers: [],
    sentiment: { positive: 1, negative: 1, score: 0 },
    topics: ['fed'],
    sector: 'fed',
  },
  {
    id: '4',
    text: 'AI technology is AMAZING. We are investing billions in American AI infrastructure. The future is going to be incredible!',
    created_at: new Date(Date.now() - 10800000).toISOString(),
    url: '',
    favorites_count: 28900,
    reblogs_count: 4800,
    tickers: ['NVDA', 'MSFT'],
    sentiment: { positive: 2, negative: 0, score: 1 },
    topics: ['ai'],
    sector: 'ai',
  },
  {
    id: '5',
    text: 'We are going to DRILL BABY DRILL. American energy independence is non-negotiable. Gas prices coming DOWN!',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    url: '',
    favorites_count: 26500,
    reblogs_count: 4200,
    tickers: [],
    sentiment: { positive: 1, negative: 0, score: 1 },
    topics: ['energy'],
    sector: 'energy',
  },
  {
    id: '6',
    text: 'The Stock Market is at RECORD levels. My administration is delivering prosperity like never before. $SPY $QQQ',
    created_at: new Date(Date.now() - 18000000).toISOString(),
    url: '',
    favorites_count: 22300,
    reblogs_count: 3800,
    tickers: ['SPY', 'QQQ'],
    sentiment: { positive: 2, negative: 0, score: 1 },
    topics: ['stocks'],
    sector: 'stocks',
  },
];

function demoSectorBreakdown() {
  return aggregateBySector(DEMO_POSTS);
}

function demoTickerMentions() {
  return aggregateMentions(DEMO_POSTS);
}

// ============ Main handler ============
export async function handleTruthWatchRequest(
  query: Record<string, string>,
  _body: string,
  _headers: IncomingHttpHeaders
): Promise<unknown> {
  const action = query.action || 'posts';
  const accountId = query.accountId || DEFAULT_ACCOUNT_ID;

  try {
    if (action === 'posts') {
      const posts = await fetchStatuses(accountId);
      const result = posts.length > 0 ? posts : DEMO_POSTS;
      return { posts: result, source: posts.length > 0 ? 'truthsocial' : 'demo' };
    }

    if (action === 'sentiment') {
      const posts = await fetchStatuses(accountId);
      const effective = posts.length > 0 ? posts : DEMO_POSTS;
      const mentions = aggregateMentions(effective);
      storePanelResults('truthwatch', mentions);
      return { mentions, source: posts.length > 0 ? 'truthsocial' : 'demo' };
    }

    if (action === 'market-impact') {
      const posts = await fetchStatuses(accountId);
      const effective = posts.length > 0 ? posts : DEMO_POSTS;
      return {
        sectorBreakdown: aggregateBySector(effective),
        tickerMentions: aggregateMentions(effective),
        totalPosts: effective.length,
        source: posts.length > 0 ? 'truthsocial' : 'demo',
      };
    }

    return { error: `Unknown action: ${action}` };
  } catch (err: any) {
    if (action === 'posts') return { posts: DEMO_POSTS, source: 'demo', error: err.message };
    if (action === 'sentiment')
      return { mentions: demoTickerMentions(), source: 'demo', error: err.message };
    if (action === 'market-impact')
      return {
        sectorBreakdown: demoSectorBreakdown(),
        tickerMentions: demoTickerMentions(),
        totalPosts: DEMO_POSTS.length,
        source: 'demo',
        error: err.message,
      };
    return { mentions: demoTickerMentions(), source: 'demo', error: err.message };
  }
}
