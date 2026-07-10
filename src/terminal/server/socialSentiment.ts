import type { IncomingHttpHeaders } from 'node:http';

const FETCH_TIMEOUT = 8000;
const REDDIT_USER_AGENT = 'MyDailyMonitor/1.0';

const COMMON_TICKERS = new Set([
  'AAPL',
  'MSFT',
  'GOOGL',
  'GOOG',
  'AMZN',
  'TSLA',
  'NVDA',
  'META',
  'NFLX',
  'AMD',
  'INTC',
  'IBM',
  'ORCL',
  'CRM',
  'ADBE',
  'QCOM',
  'TXN',
  'AVGO',
  'COST',
  'WMT',
  'HD',
  'LOW',
  'DIS',
  'NKE',
  'MCD',
  'SBUX',
  'BA',
  'JPM',
  'GS',
  'BAC',
  'C',
  'WFC',
  'V',
  'MA',
  'PYPL',
  'SQ',
  'GME',
  'AMC',
  'BB',
  'PLTR',
  'SNAP',
  'RBLX',
  'UBER',
  'LYFT',
  'BTC',
  'ETH',
  'SOL',
  'DOGE',
  'ADA',
  'XRP',
  'DOT',
  'LINK',
  'AVAX',
]);

interface PostBase {
  title: string;
  url: string;
  score: number;
  platform: string;
  thumbnail?: string;
}

export interface MentionCount {
  symbol: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: number;
  source: string;
  posts: PostBase[];
}

interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  score: number;
  permalink: string;
  thumbnail: string;
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

function extractTickers(title: string, selftext: string): string[] {
  const text = `${title} ${selftext}`;
  const found: string[] = [];
  const dollarMatches = Array.from(text.matchAll(/\$([A-Z]{2,5})\b/g));
  for (const m of dollarMatches) {
    if (COMMON_TICKERS.has(m[1])) found.push(m[1]);
  }
  const bareMatches = Array.from(text.matchAll(/\b([A-Z]{2,5})\b/g));
  for (const m of bareMatches) {
    if (COMMON_TICKERS.has(m[1])) found.push(m[1]);
  }
  return found;
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

async function fetchRedditPosts(subreddits: string[]): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  const results = await Promise.allSettled(
    subreddits.map(sub =>
      cached(`sentiment-reddit-${sub}`, async () => {
        const data = await redditFetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`
        );
        return (data.data?.children || [])
          .filter((c: any) => c.data && !c.data.stickied)
          .map((c: any) => {
            const thumb = c.data.thumbnail?.startsWith('http') ? c.data.thumbnail : '';
            const preview = c.data.preview?.images?.[0]?.source?.url;
            return {
              title: c.data.title || '',
              selftext: c.data.selftext || '',
              url: c.data.url?.startsWith('http')
                ? c.data.url
                : `https://reddit.com${c.data.permalink}`,
              score: c.data.score || 0,
              permalink: c.data.permalink || '',
              thumbnail: preview || thumb || '',
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

function countMentions(posts: RedditPost[], filterSymbol?: string): MentionCount[] {
  const mentions = new Map<
    string,
    { count: number; positiveCount: number; negativeCount: number; posts: PostBase[] }
  >();

  const POSITIVE_WORDS =
    /\b(bullish|moon|pump|buy|long|hodl|lambo|rocket|beat|win|profit|mooning|breakout|strong|growth|green|upgrade|surge|soar)\b/gi;
  const NEGATIVE_WORDS =
    /\b(bearish|dump|sell|short|crash|down|loss|bear|rug|scam|fail|plunge|drop|red|downgrade|fear|panic|bleeding)\b/gi;

  for (const post of posts) {
    const tickers = extractTickers(post.title, post.selftext);
    const uniqueTickers = Array.from(new Set(tickers));

    for (const symbol of uniqueTickers) {
      if (filterSymbol && symbol !== filterSymbol) continue;

      if (!mentions.has(symbol)) {
        mentions.set(symbol, { count: 0, positiveCount: 0, negativeCount: 0, posts: [] });
      }

      const entry = mentions.get(symbol)!;
      entry.count++;
      entry.posts.push({
        title: post.title,
        url: post.url,
        score: post.score,
        platform: 'reddit',
        thumbnail: post.thumbnail || undefined,
      });

      const text = `${post.title} ${post.selftext}`;
      const posMatches = text.match(POSITIVE_WORDS);
      const negMatches = text.match(NEGATIVE_WORDS);
      if (posMatches) entry.positiveCount += posMatches.length;
      if (negMatches) entry.negativeCount += negMatches.length;
    }
  }

  return Array.from(mentions.entries())
    .map(
      ([symbol, data]: [
        string,
        { count: number; positiveCount: number; negativeCount: number; posts: PostBase[] },
      ]) => {
        const totalKeywords = data.positiveCount + data.negativeCount;
        const sentiment =
          totalKeywords > 0
            ? Number(((data.positiveCount - data.negativeCount) / totalKeywords).toFixed(3))
            : 0;
        return {
          symbol,
          count: data.count,
          positiveCount: data.positiveCount,
          negativeCount: data.negativeCount,
          sentiment: Math.max(-1, Math.min(1, sentiment)),
          source: 'reddit',
          posts: data.posts.sort((a, b) => b.score - a.score).slice(0, 10),
        };
      }
    )
    .sort((a, b) => b.count - a.count);
}

function demoMentions(filterSymbol?: string): MentionCount[] {
  const all: MentionCount[] = [
    {
      symbol: 'NVDA',
      count: 142,
      positiveCount: 89,
      negativeCount: 12,
      sentiment: 0.762,
      source: 'reddit',
      posts: [
        {
          title: '$NVDA earnings beat expectations again',
          url: 'https://reddit.com/r/wallstreetbets',
          score: 1245,
          platform: 'reddit',
          thumbnail: 'https://picsum.photos/seed/nvda2/120/80',
        },
        {
          title: 'NVDA is the AI play of the decade',
          url: 'https://reddit.com/r/stocks',
          score: 892,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'TSLA',
      count: 98,
      positiveCount: 45,
      negativeCount: 28,
      sentiment: 0.233,
      source: 'reddit',
      posts: [
        {
          title: 'TSLA deliveries estimates revised upward',
          url: 'https://reddit.com/r/stocks',
          score: 756,
          platform: 'reddit',
        },
        {
          title: 'Elon is at it again with Tesla',
          url: 'https://reddit.com/r/wallstreetbets',
          score: 634,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'AAPL',
      count: 65,
      positiveCount: 38,
      negativeCount: 10,
      sentiment: 0.583,
      source: 'reddit',
      posts: [
        {
          title: 'AAPL new product line looks promising',
          url: 'https://reddit.com/r/stocks',
          score: 521,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'META',
      count: 48,
      positiveCount: 29,
      negativeCount: 8,
      sentiment: 0.568,
      source: 'reddit',
      posts: [
        {
          title: 'META AI investments paying off',
          url: 'https://reddit.com/r/stocks',
          score: 412,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'AMD',
      count: 42,
      positiveCount: 26,
      negativeCount: 7,
      sentiment: 0.576,
      source: 'reddit',
      posts: [
        {
          title: 'AMD taking market share from Intel',
          url: 'https://reddit.com/r/stocks',
          score: 389,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'GME',
      count: 54,
      positiveCount: 22,
      negativeCount: 14,
      sentiment: 0.222,
      source: 'reddit',
      posts: [
        {
          title: 'GME earnings play?',
          url: 'https://reddit.com/r/wallstreetbets',
          score: 345,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'PLTR',
      count: 38,
      positiveCount: 20,
      negativeCount: 6,
      sentiment: 0.538,
      source: 'reddit',
      posts: [
        {
          title: 'Palantir government contracts expanding',
          url: 'https://reddit.com/r/stocks',
          score: 298,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'MSFT',
      count: 35,
      positiveCount: 22,
      negativeCount: 4,
      sentiment: 0.692,
      source: 'reddit',
      posts: [
        {
          title: 'MSFT cloud revenue growing strong',
          url: 'https://reddit.com/r/stocks',
          score: 456,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'BTC',
      count: 31,
      positiveCount: 18,
      negativeCount: 8,
      sentiment: 0.385,
      source: 'reddit',
      posts: [
        {
          title: 'BTC on-chain metrics looking bullish',
          url: 'https://reddit.com/r/CryptoCurrency',
          score: 267,
          platform: 'reddit',
        },
      ],
    },
    {
      symbol: 'AMC',
      count: 76,
      positiveCount: 31,
      negativeCount: 18,
      sentiment: 0.265,
      source: 'reddit',
      posts: [
        {
          title: 'AMC to the moon?',
          url: 'https://reddit.com/r/wallstreetbets',
          score: 432,
          platform: 'reddit',
        },
      ],
    },
  ];

  const result = filterSymbol ? all.filter(m => m.symbol === filterSymbol) : all;
  result.sort((a, b) => b.count - a.count);
  return result.map(m => ({
    ...m,
    sentiment:
      m.positiveCount + m.negativeCount > 0
        ? Math.max(
            -1,
            Math.min(
              1,
              Number(
                ((m.positiveCount - m.negativeCount) / (m.positiveCount + m.negativeCount)).toFixed(
                  3
                )
              )
            )
          )
        : 0,
  }));
}

export interface SocialSentimentResponse {
  mentions: MentionCount[];
  source: string;
  error?: string;
}

export async function handleSocialSentimentRequest(
  query: Record<string, string>
): Promise<SocialSentimentResponse> {
  const symbol = query.symbol ? query.symbol.toUpperCase() : undefined;
  const subredditsRaw = query.subreddits || 'wallstreetbets,stocks,CryptoCurrency';
  const subreddits = subredditsRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  try {
    const posts = await fetchRedditPosts(subreddits);
    if (posts.length === 0) {
      return { mentions: demoMentions(symbol), source: 'demo' };
    }
    const mentions = countMentions(posts, symbol);
    return {
      mentions: mentions.length > 0 ? mentions : demoMentions(symbol),
      source: posts.length > 0 ? 'reddit' : 'demo',
    };
  } catch (err: any) {
    return { mentions: demoMentions(symbol), source: 'demo', error: err.message };
  }
}
