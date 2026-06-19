import { createCircuitBreaker } from '@/utils/circuit-breaker';
import { getSecret, getPreferences } from '@/services/settings-store';
import type { WatchlistEntry } from '@/config/preferences';

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

let searchAbort: AbortController | null = null;

/** Search for ticker symbols via Yahoo Finance autocomplete. */
export async function searchTickers(query: string): Promise<SymbolSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Abort any in-flight search
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();

  try {
    const resp = await fetch(`/api/symbols/search?q=${encodeURIComponent(q)}`, {
      signal: searchAbort.signal,
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

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

const quoteBreaker = createCircuitBreaker<StockQuote[]>({
  name: 'StockQuotes',
  cacheTtlMs: 30_000,
});

/**
 * Fetch stock quotes via API proxy → Finnhub + Yahoo Finance.
 * Yahoo Finance works WITHOUT an API key for indices/crypto/commodities.
 * Finnhub needs a key for individual stocks (free at finnhub.io).
 * NEVER returns fake data — returns empty array if API fails.
 */
export async function fetchStockQuotes(symbols?: string[]): Promise<StockQuote[]> {
  const prefs = getPreferences();
  const syms = symbols || prefs.stockWatchlist.map((w: WatchlistEntry) => w.symbol);
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
      const pref = prefs.stockWatchlist.find((w: WatchlistEntry) => w.symbol === sym);
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
