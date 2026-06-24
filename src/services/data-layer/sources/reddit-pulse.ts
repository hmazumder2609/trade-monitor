/**
 * Reddit Pulse data source — Reddit posts, sentiment, and breakouts.
 *
 * Wraps the existing RedditPulse service with DataLayer caching.
 * Auto-refreshes when watchlist changes.
 */

import { dataLayer } from '../DataLayer';
import { WATCHLIST_SOURCE_ID, type WatchlistEntry } from './watchlist';

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

export interface RedditPulseData {
  posts: RedditPost[];
  mentions: RedditMention[];
  breakouts: RedditBreakout[];
  bySubreddit: Record<string, RedditPost[]>;
  fetchedAt: number;
}

export const REDDIT_PULSE_SOURCE_ID = 'reddit-pulse';

/**
 * Fetch Reddit Pulse data from the API.
 */
export async function fetchRedditPulse(symbols?: string[]): Promise<RedditPulseData> {
  const syms = symbols || getWatchlistSymbolsForFetch();

  try {
    const params = new URLSearchParams({ action: 'posts' });
    if (syms && syms.length > 0) params.set('symbols', syms.join(','));

    const [postsRes, sentRes, bySubRes] = await Promise.allSettled([
      fetch(`/api/reddit-pulse?${params}`).then(r => r.json()),
      fetch(`/api/reddit-pulse?action=sentiment&symbols=${syms.join(',')}`).then(r => r.json()),
      fetch('/api/reddit-pulse?action=bysubreddit').then(r => r.json()),
    ]);

    return {
      posts: postsRes.status === 'fulfilled' ? postsRes.value.posts || [] : [],
      mentions: sentRes.status === 'fulfilled' ? sentRes.value.mentions || [] : [],
      breakouts: sentRes.status === 'fulfilled' ? sentRes.value.breakouts || [] : [],
      bySubreddit: bySubRes.status === 'fulfilled' ? bySubRes.value.groups || {} : {},
      fetchedAt: Date.now(),
    };
  } catch {
    return {
      posts: [],
      mentions: [],
      breakouts: [],
      bySubreddit: {},
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
 * Register Reddit Pulse as a DataLayer source.
 * Auto-refreshes when the watchlist changes.
 */
export function registerRedditPulseSource(): void {
  dataLayer.registerSource<RedditPulseData>({
    id: REDDIT_PULSE_SOURCE_ID,
    fetch: async () => fetchRedditPulse(),
    cache: {
      ttlMs: 3 * 60_000, // 3min
    },
  });

  // Auto-refresh when watchlist changes
  dataLayer.subscribe<WatchlistEntry[]>(WATCHLIST_SOURCE_ID, () => {
    dataLayer.fetch(REDDIT_PULSE_SOURCE_ID);
  });
}
