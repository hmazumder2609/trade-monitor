/**
 * XWatch API — Twitter/X influencer monitor.
 * Tracks configurable accounts (elonmusk, CathieDWood, RayDalio, etc.)
 * with engagement-weighted sentiment scoring.
 */
import type { IncomingHttpHeaders } from 'node:http';
import { extractTickers, analyzeSentiment } from '../utils/sentiment-analyzer';
import { storePanelResults, type PanelMention } from '../utils/signal-correlator';

const FETCH_TIMEOUT = 8000;
const TWITTER_API = 'https://api.twitter.com/2';

const DEFAULT_ACCOUNTS = [
  { username: 'elonmusk', label: 'Elon Musk' },
  { username: 'CathieDWood', label: 'Cathie Wood' },
  { username: 'RayDalio', label: 'Ray Dalio' },
];

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author: { username: string; label: string };
  like_count: number;
  retweet_count: number;
  reply_count: number;
  tickers: string[];
  sentiment: { positive: number; negative: number; score: number };
  engagementScore: number;
}

interface AccountInfo {
  username: string;
  label: string;
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

async function getBearerToken(): Promise<string | null> {
  return process.env.TWITTER_BEARER_TOKEN || null;
}

async function fetchUserId(username: string, bearer: string): Promise<string | null> {
  try {
    const resp = await fetch(`${TWITTER_API}/users/by/username/${username}`, {
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    return data.data?.id || null;
  } catch {
    return null;
  }
}

async function fetchTweets(userId: string, bearer: string): Promise<any[]> {
  const resp = await fetch(
    `${TWITTER_API}/users/${userId}/tweets?max_results=10&tweet.fields=public_metrics,created_at`,
    {
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    }
  );
  if (!resp.ok) throw new Error(`Twitter ${resp.status}`);
  const data = (await resp.json()) as any;
  return data.data || [];
}

function computeEngagementScore(
  likeCount: number,
  retweetCount: number,
  replyCount: number
): number {
  return (
    Math.log10(Math.max(1, likeCount)) * 0.5 +
    Math.log10(Math.max(1, retweetCount)) * 0.3 +
    Math.log10(Math.max(1, replyCount)) * 0.2
  );
}

async function fetchAllAccounts(accounts: AccountInfo[]): Promise<XTweet[]> {
  const bearer = await getBearerToken();
  if (!bearer) return [];

  const allTweets: XTweet[] = [];
  const results = await Promise.allSettled(
    accounts.map(async account => {
      const userId = await cached(`xwatch-user-${account.username}`, () =>
        fetchUserId(account.username, bearer!)
      );
      if (!userId) return [];
      const tweets = await cached(`xwatch-tweets-${account.username}`, () =>
        fetchTweets(userId, bearer!)
      );

      return tweets.map((t: any): XTweet => {
        const text = t.text || '';
        const metrics = t.public_metrics || {};
        const likeCount = metrics.like_count || 0;
        const retweetCount = metrics.retweet_count || 0;
        const replyCount = metrics.reply_count || 0;
        const tickers = extractTickers(text);
        const sentiment = analyzeSentiment(text);

        return {
          id: t.id,
          text: text.slice(0, 1000),
          created_at: t.created_at || '',
          author: { username: account.username, label: account.label },
          like_count: likeCount,
          retweet_count: retweetCount,
          reply_count: replyCount,
          tickers: [...new Set(tickers)],
          sentiment,
          engagementScore: computeEngagementScore(likeCount, retweetCount, replyCount),
        };
      });
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') allTweets.push(...r.value);
  }
  return allTweets;
}

function aggregateSentiment(tweets: XTweet[], filterSymbols?: string[]): PanelMention[] {
  const map = new Map<
    string,
    { count: number; weightedSentiment: number; totalEngagement: number }
  >();

  for (const tweet of tweets) {
    for (const sym of tweet.tickers) {
      if (filterSymbols && !filterSymbols.includes(sym)) continue;
      if (!map.has(sym)) map.set(sym, { count: 0, weightedSentiment: 0, totalEngagement: 0 });
      const entry = map.get(sym)!;
      entry.count++;
      entry.weightedSentiment += tweet.sentiment.score * tweet.engagementScore;
      entry.totalEngagement += tweet.engagementScore;
    }
  }

  return [...map.entries()]
    .map(([symbol, data]) => ({
      symbol,
      source: 'x' as const,
      count: data.count,
      sentiment:
        data.totalEngagement > 0
          ? Number((data.weightedSentiment / data.totalEngagement).toFixed(3))
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function groupByAccount(tweets: XTweet[]): Record<string, XTweet[]> {
  const groups: Record<string, XTweet[]> = {};
  for (const tweet of tweets) {
    if (!groups[tweet.author.label]) groups[tweet.author.label] = [];
    groups[tweet.author.label].push(tweet);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return groups;
}

// ============ Demo data ============
const DEMO_TWEETS: XTweet[] = [
  {
    id: '1',
    text: 'Bitcoin is going to change the world. The future of money is digital. $BTC',
    created_at: new Date().toISOString(),
    author: { username: 'elonmusk', label: 'Elon Musk' },
    like_count: 45231,
    retweet_count: 8921,
    reply_count: 3200,
    tickers: ['BTC'],
    sentiment: { positive: 2, negative: 0, score: 1 },
    engagementScore: 5.2,
  },
  {
    id: '2',
    text: 'Tesla AI is making huge progress. Full self driving V12 is a breakthrough. $TSLA',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    author: { username: 'elonmusk', label: 'Elon Musk' },
    like_count: 38450,
    retweet_count: 7210,
    reply_count: 2800,
    tickers: ['TSLA'],
    sentiment: { positive: 2, negative: 0, score: 1 },
    engagementScore: 4.8,
  },
  {
    id: '3',
    text: 'NVDA is a key holding in our disruptive innovation ETF. AI infrastructure spending is accelerating.',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    author: { username: 'CathieDWood', label: 'Cathie Wood' },
    like_count: 8900,
    retweet_count: 2100,
    reply_count: 650,
    tickers: ['NVDA'],
    sentiment: { positive: 1, negative: 0, score: 1 },
    engagementScore: 3.2,
  },
  {
    id: '4',
    text: 'We are in a unique AI-driven productivity boom. Innovation is happening at exponential rates.',
    created_at: new Date(Date.now() - 10800000).toISOString(),
    author: { username: 'CathieDWood', label: 'Cathie Wood' },
    like_count: 7200,
    retweet_count: 1800,
    reply_count: 420,
    tickers: [],
    sentiment: { positive: 1, negative: 0, score: 1 },
    engagementScore: 2.9,
  },
  {
    id: '5',
    text: 'The debt cycle is turning. We are seeing the beginning of a paradigm shift in the global economy.',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    author: { username: 'RayDalio', label: 'Ray Dalio' },
    like_count: 12500,
    retweet_count: 3400,
    reply_count: 890,
    tickers: [],
    sentiment: { positive: 0, negative: 0, score: 0 },
    engagementScore: 3.5,
  },
  {
    id: '6',
    text: 'Gold is a hedge against the coming debt crisis. Every portfolio should have 10-15% in gold.',
    created_at: new Date(Date.now() - 18000000).toISOString(),
    author: { username: 'RayDalio', label: 'Ray Dalio' },
    like_count: 15200,
    retweet_count: 4100,
    reply_count: 1100,
    tickers: [],
    sentiment: { positive: 1, negative: 0, score: 1 },
    engagementScore: 3.8,
  },
];

function demoSentiment() {
  return aggregateSentiment(DEMO_TWEETS);
}

function demoByAccount() {
  return groupByAccount(DEMO_TWEETS);
}

// ============ Main handler ============
export async function handleXWatchRequest(
  query: Record<string, string>,
  _body: string,
  _headers: IncomingHttpHeaders
): Promise<unknown> {
  const action = query.action || 'tweets';
  const accountsRaw = query.accounts || '';
  const accounts: AccountInfo[] = accountsRaw
    ? accountsRaw.split(',').map(s => {
        const parts = s.trim().split(':');
        return { username: parts[0], label: parts[1] || parts[0] };
      })
    : DEFAULT_ACCOUNTS;
  const symbolsRaw = query.symbols || '';
  const filterSymbols = symbolsRaw
    ? symbolsRaw
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    : undefined;

  const bearer = await getBearerToken();
  const hasAuth = bearer !== null;

  try {
    if (!hasAuth) {
      if (action === 'tweets')
        return { tweets: DEMO_TWEETS, source: 'demo', note: 'TWITTER_BEARER_TOKEN not set' };
      if (action === 'sentiment')
        return { mentions: demoSentiment(), source: 'demo', note: 'TWITTER_BEARER_TOKEN not set' };
      if (action === 'byaccount')
        return { accounts: demoByAccount(), source: 'demo', note: 'TWITTER_BEARER_TOKEN not set' };
      return { tweets: DEMO_TWEETS, source: 'demo', note: 'TWITTER_BEARER_TOKEN not set' };
    }

    if (action === 'tweets') {
      const tweets = await fetchAllAccounts(accounts);
      const result = tweets.length > 0 ? tweets : DEMO_TWEETS;
      return {
        tweets: result.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        source: tweets.length > 0 ? 'twitter' : 'demo',
      };
    }

    if (action === 'sentiment') {
      const tweets = await fetchAllAccounts(accounts);
      const effective = tweets.length > 0 ? tweets : DEMO_TWEETS;
      const mentions = aggregateSentiment(effective, filterSymbols);
      storePanelResults('xwatch', mentions);
      return { mentions, source: tweets.length > 0 ? 'twitter' : 'demo' };
    }

    if (action === 'byaccount') {
      const tweets = await fetchAllAccounts(accounts);
      const effective = tweets.length > 0 ? tweets : DEMO_TWEETS;
      return {
        accounts: groupByAccount(effective),
        source: tweets.length > 0 ? 'twitter' : 'demo',
      };
    }

    return { error: `Unknown action: ${action}` };
  } catch (err: any) {
    if (action === 'tweets') return { tweets: DEMO_TWEETS, source: 'demo', error: err.message };
    if (action === 'sentiment')
      return { mentions: demoSentiment(), source: 'demo', error: err.message };
    if (action === 'byaccount')
      return { accounts: demoByAccount(), source: 'demo', error: err.message };
    return { tweets: DEMO_TWEETS, source: 'demo', error: err.message };
  }
}
