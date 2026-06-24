/**
 * X Watch data source — Twitter/X tweets, sentiment, and by-account data.
 *
 * Wraps the existing XWatch service with DataLayer caching.
 * Auto-refreshes when watchlist changes.
 */

import { dataLayer } from '../DataLayer';
import { WATCHLIST_SOURCE_ID, type WatchlistEntry } from './watchlist';

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

export interface XWatchData {
  tweets: XTweet[];
  mentions: XWatchMention[];
  byAccount: Record<string, XTweet[]>;
  fetchedAt: number;
}

export const X_WATCH_SOURCE_ID = 'x-watch';

/**
 * Fetch X Watch data from the API.
 */
export async function fetchXWatch(symbols?: string[]): Promise<XWatchData> {
  const syms = symbols || getWatchlistSymbolsForFetch();

  try {
    const params = new URLSearchParams({ action: 'tweets' });
    if (syms && syms.length > 0) params.set('symbols', syms.join(','));

    const [tweetsRes, sentRes, byAcctRes] = await Promise.allSettled([
      fetch(`/api/xwatch?${params}`).then(r => r.json()),
      fetch(`/api/xwatch?action=sentiment&symbols=${syms.join(',')}`).then(r => r.json()),
      fetch('/api/xwatch?action=byaccount').then(r => r.json()),
    ]);

    return {
      tweets: tweetsRes.status === 'fulfilled' ? tweetsRes.value.tweets || [] : [],
      mentions: sentRes.status === 'fulfilled' ? sentRes.value.mentions || [] : [],
      byAccount: byAcctRes.status === 'fulfilled' ? byAcctRes.value.accounts || {} : {},
      fetchedAt: Date.now(),
    };
  } catch {
    return {
      tweets: [],
      mentions: [],
      byAccount: {},
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
 * Register X Watch as a DataLayer source.
 * Auto-refreshes when the watchlist changes.
 */
export function registerXWatchSource(): void {
  dataLayer.registerSource<XWatchData>({
    id: X_WATCH_SOURCE_ID,
    fetch: async () => fetchXWatch(),
    cache: {
      ttlMs: 3 * 60_000, // 3min
    },
  });

  // Auto-refresh when watchlist changes
  dataLayer.subscribe<WatchlistEntry[]>(WATCHLIST_SOURCE_ID, () => {
    dataLayer.fetch(X_WATCH_SOURCE_ID);
  });
}
