import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface MentionCount {
  symbol: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: number;
  source: string;
  posts: { title: string; url: string; score: number; platform: string }[];
}

const mentionsBreaker = createCircuitBreaker<{ mentions: MentionCount[]; source: string }>({
  name: 'SocialMentions',
  cacheTtlMs: 3 * 60_000,
});

const twitterBreaker = createCircuitBreaker<{ sentiment: MentionCount[]; source: string }>({
  name: 'TwitterSentiment',
  cacheTtlMs: 3 * 60_000,
});

const trendingBreaker = createCircuitBreaker<{ trending: MentionCount[]; source: string }>({
  name: 'SocialTrending',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchMentions(
  symbols?: string[]
): Promise<{ mentions: MentionCount[]; source: string }> {
  return mentionsBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'mentions' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/social-sentiment?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { mentions: [], source: '' }
  );
}

export async function fetchTwitterSentiment(
  symbols?: string[]
): Promise<{ sentiment: MentionCount[]; source: string }> {
  return twitterBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'sentiment' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/social-sentiment?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { sentiment: [], source: '' }
  );
}

export async function fetchTrending(
  symbols?: string[]
): Promise<{ trending: MentionCount[]; source: string }> {
  return trendingBreaker.execute(
    async () => {
      const params = new URLSearchParams({ action: 'trending' });
      if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
      const resp = await fetch(`/api/social-sentiment?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { trending: [], source: '' }
  );
}
