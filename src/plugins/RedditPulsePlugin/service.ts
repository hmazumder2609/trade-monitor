import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  score: number;
  permalink: string;
  subreddit: string;
  created_utc: number;
  contentType: string;
  tickers: string[];
  sentiment: { positive: number; negative: number; score: number };
}

export interface RedditMention {
  symbol: string;
  source: string;
  count: number;
  sentiment: number;
  topics?: string[];
}

export interface RedditBreakout {
  symbol: string;
  zScore: number;
  isBreakout: boolean;
}

const postsBreaker = createCircuitBreaker<{ posts: RedditPost[]; source: string }>({
  name: 'RedditPulsePosts',
  cacheTtlMs: 3 * 60_000,
});

const sentimentBreaker = createCircuitBreaker<{
  mentions: RedditMention[];
  breakouts: RedditBreakout[];
  source: string;
}>({
  name: 'RedditPulseSentiment',
  cacheTtlMs: 3 * 60_000,
});

const bySubBreaker = createCircuitBreaker<{ groups: Record<string, RedditPost[]>; source: string }>(
  {
    name: 'RedditPulseBySub',
    cacheTtlMs: 3 * 60_000,
  }
);

export async function fetchPosts(
  symbols?: string[]
): Promise<{ posts: RedditPost[]; source: string }> {
  return postsBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'posts' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/reddit-pulse?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { posts: [], source: '' }
  );
}

export async function fetchSentiment(
  symbols?: string[]
): Promise<{ mentions: RedditMention[]; breakouts: RedditBreakout[]; source: string }> {
  return sentimentBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'sentiment' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/reddit-pulse?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { mentions: [], breakouts: [], source: '' }
  );
}

export async function fetchBySubreddit(): Promise<{
  groups: Record<string, RedditPost[]>;
  source: string;
}> {
  return bySubBreaker.execute(
    async () => {
      const resp = await fetch('/api/reddit-pulse?action=bysubreddit');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { groups: {}, source: '' }
  );
}
