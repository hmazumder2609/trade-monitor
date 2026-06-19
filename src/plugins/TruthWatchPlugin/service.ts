import { createCircuitBreaker } from '@/utils/circuit-breaker';

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

export interface TruthWatchMention {
  symbol: string;
  source: string;
  count: number;
  sentiment: number;
}

export interface SectorBreakdown {
  [sector: string]: { count: number; avgSentiment: number };
}

export interface MarketImpact {
  sectorBreakdown: SectorBreakdown;
  tickerMentions: TruthWatchMention[];
  totalPosts: number;
  source: string;
}

const postsBreaker = createCircuitBreaker<{ posts: TruthPost[]; source: string }>({
  name: 'TruthWatchPosts',
  cacheTtlMs: 3 * 60_000,
});

const sentimentBreaker = createCircuitBreaker<{ mentions: TruthWatchMention[]; source: string }>({
  name: 'TruthWatchSentiment',
  cacheTtlMs: 3 * 60_000,
});

const impactBreaker = createCircuitBreaker<MarketImpact>({
  name: 'TruthWatchImpact',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchPosts(): Promise<{ posts: TruthPost[]; source: string }> {
  return postsBreaker.execute(
    async () => {
      const resp = await fetch('/api/truthwatch?action=posts');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { posts: [], source: '' }
  );
}

export async function fetchSentiment(): Promise<{ mentions: TruthWatchMention[]; source: string }> {
  return sentimentBreaker.execute(
    async () => {
      const resp = await fetch('/api/truthwatch?action=sentiment');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { mentions: [], source: '' }
  );
}

export async function fetchMarketImpact(): Promise<MarketImpact> {
  return impactBreaker.execute(
    async () => {
      const resp = await fetch('/api/truthwatch?action=market-impact');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { sectorBreakdown: {}, tickerMentions: [], totalPosts: 0, source: '' }
  );
}
