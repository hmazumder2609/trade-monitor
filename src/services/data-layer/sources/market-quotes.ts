/**
 * Market quotes data source — fetches real-time stock/crypto/commodity quotes.
 *
 * Fetches from `/api/stocks` (Finnhub + Yahoo Finance).
 * Uses the watchlist as the default symbol set.
 */

import { dataLayer } from '../DataLayer';
import { getSecret } from '@/services/settings-store';
import { WATCHLIST_SOURCE_ID, type WatchlistEntry } from './watchlist';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface StockQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  sparkline?: number[];
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export const MARKET_QUOTES_SOURCE_ID = 'market-quotes';

const quoteBreaker = createCircuitBreaker<StockQuote[]>({
  name: 'DataLayerQuotes',
  cacheTtlMs: 30_000,
});

/**
 * Fetch quotes for specific symbols (or watchlist if omitted).
 */
export async function fetchQuotes(symbols?: string[]): Promise<StockQuote[]> {
  const syms = symbols || getWatchlistSymbolsForFetch();
  if (syms.length === 0) return [];

  const finnhubKey = getSecret('FINNHUB_API_KEY');

  return quoteBreaker.execute(async () => {
    const headers: Record<string, string> = {};
    if (finnhubKey) headers['X-Finnhub-Key'] = finnhubKey;

    const resp = await fetch(`/api/stocks?symbols=${syms.join(',')}`, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return (data.quotes || []).map((q: Record<string, unknown>) => {
      const sym = q.symbol as string;
      const watchlist = dataLayer.getData<WatchlistEntry[]>(WATCHLIST_SOURCE_ID) || [];
      const pref = watchlist.find(w => w.symbol === sym);
      return {
        symbol: sym,
        name: pref?.name || (q.name as string) || sym,
        price: (q.price as number) ?? null,
        change: (q.change as number) ?? null,
        changePercent: (q.changePercent as number) ?? null,
        high: (q.high as number) ?? null,
        low: (q.low as number) ?? null,
        sparkline: (q.sparkline as number[]) || undefined,
      };
    });
  }, []);
}

/**
 * Search for ticker symbols.
 */
export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const resp = await fetch(`/api/symbols/search?q=${encodeURIComponent(q)}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
//  Internal helpers
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
//  DataLayer registration
// ──────────────────────────────────────────────

/**
 * Register market quotes as a DataLayer source.
 * Automatically re-fetches when the watchlist changes.
 */
export function registerMarketQuotesSource(): void {
  dataLayer.registerSource<StockQuote[]>({
    id: MARKET_QUOTES_SOURCE_ID,
    fetch: async () => fetchQuotes(),
    cache: {
      ttlMs: 30_000, // 30s — quotes change frequently
    },
  });

  // Auto-refresh when watchlist changes
  dataLayer.subscribe<WatchlistEntry[]>(WATCHLIST_SOURCE_ID, () => {
    dataLayer.fetch(MARKET_QUOTES_SOURCE_ID);
  });
}
