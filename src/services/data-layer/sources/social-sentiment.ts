/**
 * Social Sentiment data source — Reddit + Twitter mentions and sentiment.
 *
 * Wraps the existing social-sentiment service with DataLayer caching.
 * Auto-refreshes when watchlist changes.
 */

import { dataLayer } from '../DataLayer';
import { WATCHLIST_SOURCE_ID, type WatchlistEntry } from './watchlist';

export interface MentionCount {
  symbol: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: number;
  source: string;
  posts: { title: string; url: string; score: number; platform: string; thumbnail?: string }[];
}

export interface SocialSentimentData {
  trending: MentionCount[];
  mentions: MentionCount[];
  twitterSentiment: MentionCount[];
  truthSocial: MentionCount[];
  fetchedAt: number;
}

export const SOCIAL_SENTIMENT_SOURCE_ID = 'social-sentiment';

/**
 * Fetch social sentiment data from the API.
 */
export async function fetchSocialSentiment(symbols?: string[]): Promise<SocialSentimentData> {
  const syms = symbols || getWatchlistSymbolsForFetch();

  try {
    const { fetchTrending, fetchMentions, fetchTwitterSentiment, fetchTruthSentiment } =
      await import('@/services/social-sentiment');

    const [trendingRes, mentionsRes, twitterRes, truthRes] = await Promise.allSettled([
      fetchTrending(syms),
      fetchMentions(syms),
      fetchTwitterSentiment(syms),
      fetchTruthSentiment(),
    ]);

    return {
      trending: trendingRes.status === 'fulfilled' ? trendingRes.value.trending || [] : [],
      mentions: mentionsRes.status === 'fulfilled' ? mentionsRes.value.mentions || [] : [],
      twitterSentiment: twitterRes.status === 'fulfilled' ? twitterRes.value.sentiment || [] : [],
      truthSocial: truthRes.status === 'fulfilled' ? truthRes.value.truthPosts || [] : [],
      fetchedAt: Date.now(),
    };
  } catch {
    return {
      trending: [],
      mentions: [],
      twitterSentiment: [],
      truthSocial: [],
      fetchedAt: Date.now(),
    };
  }
}

/**
 * Get watchlist symbols for fetching.
 */
function getWatchlistSymbolsForFetch(): string[] {
  const watchlist = dataLayer.getData<WatchlistEntry[]>(WATCHLIST_SOURCE_ID);
  if (watchlist && watchlist.length > 0) {
    return watchlist.map(w => w.symbol);
  }

  // Fallback: read directly from localStorage
  try {
    const raw = localStorage.getItem('mdm-watchlist-v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((w: WatchlistEntry) => w.symbol);
    }
  } catch {}

  // Last resort: defaults
  return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META'];
}

/**
 * Register social sentiment as a DataLayer source.
 * Auto-refreshes when the watchlist changes.
 */
export function registerSocialSentimentSource(): void {
  dataLayer.registerSource<SocialSentimentData>({
    id: SOCIAL_SENTIMENT_SOURCE_ID,
    fetch: async () => fetchSocialSentiment(),
    cache: {
      ttlMs: 3 * 60_000, // 3min — sentiment changes less frequently
    },
  });

  // Auto-refresh when watchlist changes
  dataLayer.subscribe<WatchlistEntry[]>(WATCHLIST_SOURCE_ID, () => {
    dataLayer.fetch(SOCIAL_SENTIMENT_SOURCE_ID);
  });
}
