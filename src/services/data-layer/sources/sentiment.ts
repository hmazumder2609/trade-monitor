/**
 * Sentiment data source — per-symbol news/social sentiment scores.
 *
 * Aggregates sentiment from news articles and social media mentions.
 * Per-symbol sources (e.g., `sentiment:AAPL`).
 *
 * Uses existing /api/social-sentiment endpoint.
 */

import { dataLayer } from '../DataLayer';

export interface SentimentData {
  symbol: string;
  /** Overall sentiment score (-1 = bearish, 0 = neutral, 1 = bullish). */
  score: number;
  /** Number of news articles in the last 7 days. */
  newsCount: number;
  /** Number of social mentions (Reddit + Twitter). */
  mentionCount: number;
  /** Trending direction: 'up' | 'down' | 'stable'. */
  trend: 'up' | 'down' | 'stable';
  /** Top 3 recent headlines. */
  topHeadlines: { title: string; source: string; url?: string }[];
  /** When this data was fetched. */
  fetchedAt: number;
}

/**
 * Generate a DataLayer source ID for a symbol.
 */
export function sentimentSourceId(symbol: string): string {
  return `sentiment:${symbol}`;
}

/**
 * Fetch sentiment data for a single symbol.
 */
export async function fetchSentiment(symbol: string): Promise<SentimentData> {
  const base: SentimentData = {
    symbol,
    score: 0,
    newsCount: 0,
    mentionCount: 0,
    trend: 'stable',
    topHeadlines: [],
    fetchedAt: Date.now(),
  };

  try {
    // Fetch mentions from social-sentiment endpoint
    const resp = await fetch(
      `/api/social-sentiment?action=mentions&symbol=${encodeURIComponent(symbol)}`
    );
    if (!resp.ok) return base;

    const data = await resp.json();
    const mentions = data.mentions || [];

    // Aggregate sentiment from mentions
    let totalScore = 0;
    let count = 0;
    const headlines: { title: string; source: string; url?: string }[] = [];

    for (const m of mentions) {
      if (m.sentiment != null) {
        totalScore += m.sentiment;
        count++;
      }
      if (m.title && headlines.length < 3) {
        headlines.push({
          title: m.title,
          source: m.source || 'Unknown',
          url: m.url,
        });
      }
    }

    const score = count > 0 ? totalScore / count : 0;
    const newsCount = mentions.filter(
      (m: Record<string, unknown>) => m.type === 'news' || !m.type
    ).length;
    const mentionCount = mentions.length;

    // Simple trend detection (compare first half vs second half sentiment)
    const mid = Math.floor(mentions.length / 2);
    const firstHalf = mentions.slice(0, mid);
    const secondHalf = mentions.slice(mid);
    const avgFirst =
      firstHalf.length > 0
        ? firstHalf.reduce(
            (sum: number, m: Record<string, unknown>) => sum + ((m.sentiment as number) || 0),
            0
          ) / firstHalf.length
        : 0;
    const avgSecond =
      secondHalf.length > 0
        ? secondHalf.reduce(
            (sum: number, m: Record<string, unknown>) => sum + ((m.sentiment as number) || 0),
            0
          ) / secondHalf.length
        : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (avgSecond - avgFirst > 0.1) trend = 'up';
    else if (avgFirst - avgSecond > 0.1) trend = 'down';

    return {
      symbol,
      score,
      newsCount,
      mentionCount,
      trend,
      topHeadlines: headlines,
      fetchedAt: Date.now(),
    };
  } catch {
    return base;
  }
}

/**
 * Register a sentiment source for a specific symbol.
 * Safe to call multiple times — skips if already registered.
 */
export function registerSentimentSource(symbol: string): void {
  const id = sentimentSourceId(symbol);

  if (dataLayer.hasSource(id)) return;

  dataLayer.registerSource<SentimentData>({
    id,
    fetch: async () => fetchSentiment(symbol),
    cache: {
      ttlMs: 600_000, // 10min — sentiment doesn't change as fast as prices
    },
  });
}

/**
 * Ensure sentiment sources exist for all watchlist symbols.
 */
export function registerSentimentForWatchlist(symbols: string[]): void {
  for (const symbol of symbols) {
    registerSentimentSource(symbol);
  }
}

/**
 * Get cached sentiment for a symbol.
 * Returns null if not yet fetched.
 */
export function getSentiment(symbol: string): SentimentData | null {
  return dataLayer.getData<SentimentData>(sentimentSourceId(symbol));
}
