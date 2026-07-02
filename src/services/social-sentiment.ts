import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface MentionCount {
  symbol: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: number;
  source: string;
  posts: { title: string; url: string; score: number; platform: string; thumbnail?: string }[];
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

const truthBreaker = createCircuitBreaker<{ truthPosts: MentionCount[]; source: string }>({
  name: 'TruthSentiment',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchTruthSentiment(): Promise<{
  truthPosts: MentionCount[];
  source: string;
}> {
  return truthBreaker.execute(
    async () => {
      const resp = await fetch(`/api/truthwatch?action=posts&limit=50`);
      if (!resp.ok) return { truthPosts: [], source: 'unavailable' };
      const data = await resp.json();
      const posts: any[] = data.posts || [];
      const mentionMap = new Map<
        string,
        {
          count: number;
          positive: number;
          negative: number;
          posts: { title: string; url: string; score: number; platform: string }[];
        }
      >();

      const POSITIVE =
        /\b(bullish|moon|pump|buy|long|profit|breakout|strong|growth|green|surge|soar|beat|win|up)\b/gi;
      const NEGATIVE =
        /\b(bearish|dump|sell|short|crash|loss|bear|scam|fail|plunge|drop|red|fear|panic|bleeding|down)\b/gi;

      for (const p of posts) {
        const tickers: string[] = p.tickers || [];
        for (const sym of tickers) {
          if (!mentionMap.has(sym))
            mentionMap.set(sym, { count: 0, positive: 0, negative: 0, posts: [] });
          const entry = mentionMap.get(sym)!;
          entry.count++;
          entry.posts.push({
            title: (p.text || '').slice(0, 200),
            url: p.url || '',
            score: (p.favorites_count || 0) + (p.reblogs_count || 0),
            platform: 'truthsocial',
          });
          const text = p.text || '';
          const pos = (text.match(POSITIVE) || []).length;
          const neg = (text.match(NEGATIVE) || []).length;
          entry.positive += pos;
          entry.negative += neg;
        }
      }

      const truthPosts: MentionCount[] = [...mentionMap.entries()]
        .map(([symbol, data]) => {
          const totalKw = data.positive + data.negative;
          return {
            symbol,
            count: data.count,
            positiveCount: data.positive,
            negativeCount: data.negative,
            sentiment:
              totalKw > 0 ? Number(((data.positive - data.negative) / totalKw).toFixed(3)) : 0,
            source: 'truthsocial',
            posts: data.posts.slice(0, 10),
          };
        })
        .sort((a, b) => b.count - a.count);

      return { truthPosts, source: data.source || 'truthsocial' };
    },
    { truthPosts: [], source: '' }
  );
}
