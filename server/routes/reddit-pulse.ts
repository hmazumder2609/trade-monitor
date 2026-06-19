/**
 * RedditPulse API — Trading community pulse monitor.
 * Aggregates posts from trading-focused subreddits with weighted scoring.
 */
import type { IncomingHttpHeaders } from 'node:http';
import {
  extractTickers,
  analyzeSentiment,
  classifyContent,
  weightedScore,
  detectBreakout,
  type ContentType,
} from '../utils/sentiment-analyzer';
import { storePanelResults, type PanelMention } from '../utils/signal-correlator';

const FETCH_TIMEOUT = 8000;
const REDDIT_USER_AGENT = 'MyDailyMonitor/1.0';

const DEFAULT_SUBREDDITS = [
  'wallstreetbets',
  'stocks',
  'options',
  'thetagang',
  'valueinvesting',
  'tfsa_millionaires',
  'CanadianInvestor',
  'CryptoCurrency',
  'Superstonk',
  'WSBOGs',
];

export interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  score: number;
  permalink: string;
  subreddit: string;
  created_utc: number;
  contentType: ContentType;
  tickers: string[];
  sentiment: { positive: number; negative: number; score: number };
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

async function redditFetch(url: string): Promise<any> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const headers: Record<string, string> = { 'User-Agent': REDDIT_USER_AGENT };

  if (clientId && clientSecret) {
    const tokenResp = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT,
      },
      body: 'grant_type=client_credentials',
    });
    if (tokenResp.ok) {
      const tokenData = (await tokenResp.json()) as any;
      if (tokenData.access_token) {
        headers['Authorization'] = `Bearer ${tokenData.access_token}`;
      }
    }
  }

  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!resp.ok) throw new Error(`Reddit ${resp.status}`);
  return resp.json();
}

async function fetchPosts(subreddits: string[]): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  const results = await Promise.allSettled(
    subreddits.map(sub =>
      cached(`reddit-pulse-${sub}`, async () => {
        const data = await redditFetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`
        );
        return (data.data?.children || [])
          .filter((c: any) => c.data && !c.data.stickied)
          .map((c: any): RedditPost => {
            const title = c.data.title || '';
            const body = c.data.selftext || '';
            const tickers = extractTickers(`${title} ${body}`);
            const sentiment = analyzeSentiment(`${title} ${body}`);
            return {
              title,
              selftext: c.data.selftext?.slice(0, 500) || '',
              url: c.data.url?.startsWith('http')
                ? c.data.url
                : `https://reddit.com${c.data.permalink}`,
              score: c.data.score || 0,
              permalink: c.data.permalink || '',
              subreddit: sub,
              created_utc: c.data.created_utc || 0,
              contentType: classifyContent(title, body),
              tickers: [...new Set(tickers)],
              sentiment,
            };
          });
      })
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }
  return posts;
}

function aggregateSentiment(posts: RedditPost[], filterSymbols?: string[]): PanelMention[] {
  const map = new Map<string, { count: number; sentiment: number; totalScore: number }>();

  for (const post of posts) {
    for (const sym of post.tickers) {
      if (filterSymbols && !filterSymbols.includes(sym)) continue;
      if (!map.has(sym)) map.set(sym, { count: 0, sentiment: 0, totalScore: 0 });
      const entry = map.get(sym)!;
      entry.count++;
      entry.sentiment += post.sentiment.score;
      entry.totalScore += weightedScore(1, post.score, post.subreddit, post.contentType);
    }
  }

  const result: PanelMention[] = [];
  for (const [symbol, data] of map) {
    const sortedPosts = posts
      .filter(p => p.tickers.includes(symbol))
      .sort((a, b) => b.score - a.score);

    result.push({
      symbol,
      source: 'reddit',
      count: data.count,
      sentiment: Number((data.sentiment / data.count).toFixed(3)),
      topics: sortedPosts.slice(0, 5).map(p => p.contentType),
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

function computeBreakouts(
  posts: RedditPost[]
): { symbol: string; zScore: number; isBreakout: boolean }[] {
  const velMap = new Map<string, number[]>();
  const now = Date.now() / 1000;
  for (const post of posts) {
    for (const sym of post.tickers) {
      if (!velMap.has(sym)) velMap.set(sym, []);
      const age = Math.max(1, (now - post.created_utc) / 3600);
      velMap.get(sym)!.push(post.score / age);
    }
  }

  const breakouts: { symbol: string; zScore: number; isBreakout: boolean }[] = [];
  for (const [symbol, velocities] of velMap) {
    if (velocities.length < 2) continue;
    const current = velocities[0];
    const history = velocities.slice(1);
    const { isBreakout, zScore } = detectBreakout(current, history);
    breakouts.push({ symbol, zScore, isBreakout });
  }
  return breakouts.sort((a, b) => b.zScore - a.zScore);
}

function groupBySubreddit(posts: RedditPost[]): Record<string, RedditPost[]> {
  const groups: Record<string, RedditPost[]> = {};
  for (const post of posts) {
    if (!groups[post.subreddit]) groups[post.subreddit] = [];
    groups[post.subreddit].push(post);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a: RedditPost, b: RedditPost) => b.score - a.score);
  }
  return groups;
}

// ============ Demo data ============
const DEMO_POSTS: RedditPost[] = [
  {
    title: '$NVDA earnings beat expectations again',
    selftext:
      'Another quarter of record revenue from their AI segment. Data center revenue up 400% YoY.',
    url: 'https://reddit.com/r/wallstreetbets',
    score: 1245,
    permalink: '/r/wallstreetbets',
    subreddit: 'wallstreetbets',
    created_utc: Date.now() / 1000 - 1800,
    contentType: 'news',
    tickers: ['NVDA'],
    sentiment: { positive: 3, negative: 0, score: 1 },
  },
  {
    title: 'NVDA is the AI play of the decade — full DD',
    selftext:
      'Let me break down why NVIDIA is positioned to dominate the AI chip market for the next decade. Their CUDA moat is unassailable.',
    url: 'https://reddit.com/r/stocks',
    score: 892,
    permalink: '/r/stocks',
    subreddit: 'stocks',
    created_utc: Date.now() / 1000 - 3600,
    contentType: 'analysis',
    tickers: ['NVDA'],
    sentiment: { positive: 2, negative: 0, score: 1 },
  },
  {
    title: 'Bought more NVDA calls 🚀',
    selftext: 'YOLO',
    url: 'https://reddit.com/r/wallstreetbets',
    score: 567,
    permalink: '/r/wallstreetbets',
    subreddit: 'wallstreetbets',
    created_utc: Date.now() / 1000 - 600,
    contentType: 'meme',
    tickers: ['NVDA'],
    sentiment: { positive: 1, negative: 0, score: 1 },
  },
  {
    title: 'TSLA deliveries estimates revised upward',
    selftext: 'Analysts raising Q2 delivery estimates based on China registration data.',
    url: 'https://reddit.com/r/stocks',
    score: 756,
    permalink: '/r/stocks',
    subreddit: 'stocks',
    created_utc: Date.now() / 1000 - 2400,
    contentType: 'news',
    tickers: ['TSLA'],
    sentiment: { positive: 2, negative: 0, score: 1 },
  },
  {
    title: 'Bearish on TSLA — competition is heating up',
    selftext:
      "With BYD, NIO, and legacy automakers all entering the EV space, Tesla's market share is going to compress.",
    url: 'https://reddit.com/r/stocks',
    score: 634,
    permalink: '/r/stocks',
    subreddit: 'stocks',
    created_utc: Date.now() / 1000 - 7200,
    contentType: 'analysis',
    tickers: ['TSLA'],
    sentiment: { positive: 0, negative: 3, score: -1 },
  },
  {
    title: 'AMC to the moon?',
    selftext: 'Earnings next week, could be interesting',
    url: 'https://reddit.com/r/wallstreetbets',
    score: 432,
    permalink: '/r/wallstreetbets',
    subreddit: 'wallstreetbets',
    created_utc: Date.now() / 1000 - 1200,
    contentType: 'meme',
    tickers: ['AMC'],
    sentiment: { positive: 1, negative: 0, score: 1 },
  },
  {
    title: 'AAPL new product line looks promising',
    selftext: 'Vision Pro 2 and iPhone 17 supply chain checks are positive.',
    url: 'https://reddit.com/r/stocks',
    score: 521,
    permalink: '/r/stocks',
    subreddit: 'stocks',
    created_utc: Date.now() / 1000 - 5400,
    contentType: 'news',
    tickers: ['AAPL'],
    sentiment: { positive: 2, negative: 0, score: 1 },
  },
  {
    title: 'GME earnings play? Deep ITM calls',
    selftext: 'Looking at the options chain for June expiry',
    url: 'https://reddit.com/r/wallstreetbets',
    score: 345,
    permalink: '/r/wallstreetbets',
    subreddit: 'wallstreetbets',
    created_utc: Date.now() / 1000 - 900,
    contentType: 'sentiment',
    tickers: ['GME'],
    sentiment: { positive: 1, negative: 0, score: 1 },
  },
  {
    title: 'META AI investments paying off',
    selftext: 'Meta AI assistant reaching 400M monthly active users.',
    url: 'https://reddit.com/r/stocks',
    score: 412,
    permalink: '/r/stocks',
    subreddit: 'stocks',
    created_utc: Date.now() / 1000 - 3600,
    contentType: 'news',
    tickers: ['META'],
    sentiment: { positive: 2, negative: 0, score: 1 },
  },
];

function demoSentiment(): PanelMention[] {
  return aggregateSentiment(DEMO_POSTS);
}

function demoBreakouts() {
  return computeBreakouts(DEMO_POSTS);
}

function demoBySubreddit() {
  return groupBySubreddit(DEMO_POSTS);
}

// ============ Main handler ============
export async function handleRedditPulseRequest(
  query: Record<string, string>,
  _body: string,
  _headers: IncomingHttpHeaders
): Promise<unknown> {
  const action = query.action || 'posts';
  const subredditsRaw = query.subreddits || DEFAULT_SUBREDDITS.join(',');
  const subreddits = subredditsRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const symbolsRaw = query.symbols || '';
  const filterSymbols = symbolsRaw
    ? symbolsRaw
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    : undefined;

  try {
    if (action === 'posts') {
      const posts = await fetchPosts(subreddits);
      const result = posts.length > 0 ? posts : DEMO_POSTS;
      return {
        posts: result.sort((a, b) => b.score - a.score),
        source: posts.length > 0 ? 'reddit' : 'demo',
      };
    }

    if (action === 'sentiment') {
      const posts = await fetchPosts(subreddits);
      const source = posts.length > 0 ? 'reddit' : 'demo';
      const effectivePosts = posts.length > 0 ? posts : DEMO_POSTS;
      const mentions = aggregateSentiment(effectivePosts, filterSymbols);
      const breakouts = computeBreakouts(effectivePosts);
      storePanelResults('reddit-pulse', mentions);
      return { mentions, breakouts, source };
    }

    if (action === 'bysubreddit') {
      const posts = await fetchPosts(subreddits);
      const effectivePosts = posts.length > 0 ? posts : DEMO_POSTS;
      return {
        groups: groupBySubreddit(effectivePosts),
        source: posts.length > 0 ? 'reddit' : 'demo',
      };
    }

    if (action === 'breakouts') {
      const posts = await fetchPosts(subreddits);
      const effectivePosts = posts.length > 0 ? posts : DEMO_POSTS;
      return {
        breakouts: computeBreakouts(effectivePosts),
        source: posts.length > 0 ? 'reddit' : 'demo',
      };
    }

    return { error: `Unknown action: ${action}` };
  } catch (err: any) {
    if (action === 'posts') return { posts: DEMO_POSTS, source: 'demo', error: err.message };
    if (action === 'sentiment')
      return {
        mentions: demoSentiment(),
        breakouts: demoBreakouts(),
        source: 'demo',
        error: err.message,
      };
    if (action === 'bysubreddit')
      return { groups: demoBySubreddit(), source: 'demo', error: err.message };
    return { mentions: demoSentiment(), source: 'demo', error: err.message };
  }
}
