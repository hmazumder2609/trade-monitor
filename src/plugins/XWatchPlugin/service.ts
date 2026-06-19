import { createCircuitBreaker } from '@/utils/circuit-breaker';

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

export interface XWatchMention {
  symbol: string;
  source: string;
  count: number;
  sentiment: number;
}

const tweetsBreaker = createCircuitBreaker<{ tweets: XTweet[]; source: string }>({
  name: 'XWatchTweets',
  cacheTtlMs: 3 * 60_000,
});

const sentimentBreaker = createCircuitBreaker<{ mentions: XWatchMention[]; source: string }>({
  name: 'XWatchSentiment',
  cacheTtlMs: 3 * 60_000,
});

const byAccountBreaker = createCircuitBreaker<{
  accounts: Record<string, XTweet[]>;
  source: string;
}>({
  name: 'XWatchByAccount',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchTweets(
  symbols?: string[]
): Promise<{ tweets: XTweet[]; source: string }> {
  return tweetsBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'tweets' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/xwatch?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { tweets: [], source: '' }
  );
}

export async function fetchSentiment(
  symbols?: string[]
): Promise<{ mentions: XWatchMention[]; source: string }> {
  return sentimentBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'sentiment' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/xwatch?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { mentions: [], source: '' }
  );
}

export async function fetchByAccount(): Promise<{
  accounts: Record<string, XTweet[]>;
  source: string;
}> {
  return byAccountBreaker.execute(
    async () => {
      const resp = await fetch('/api/xwatch?action=byaccount');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { accounts: {}, source: '' }
  );
}
