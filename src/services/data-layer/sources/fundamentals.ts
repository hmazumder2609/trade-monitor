/**
 * Fundamentals data source — per-symbol fundamental data.
 *
 * Provides P/E ratio, EPS, market cap, sector, industry, earnings date.
 * Per-symbol sources (e.g., `fundamentals:AAPL`).
 *
 * Server route: /api/fundamentals (to be created if not exists).
 * Falls back to Finnhub profile endpoint directly.
 */

import { dataLayer } from '../DataLayer';
import { getSecret } from '@/services/settings-store';

export interface Fundamentals {
  symbol: string;
  /** Price-to-earnings ratio. */
  peRatio: number | null;
  /** Earnings per share (trailing twelve months). */
  eps: number | null;
  /** Market capitalization in USD. */
  marketCap: number | null;
  /** Sector classification. */
  sector: string | null;
  /** Industry classification. */
  industry: string | null;
  /** Company description (short). */
  description: string | null;
  /** Dividend yield (%). */
  dividendYield: number | null;
  /** 52-week high. */
  week52High: number | null;
  /** 52-week low. */
  week52Low: number | null;
  /** Average daily volume. */
  avgVolume: number | null;
  /** Earnings date (next scheduled). */
  earningsDate: string | null;
  /** When this data was fetched. */
  fetchedAt: number;
}

/**
 * Generate a DataLayer source ID for a symbol.
 */
export function fundamentalsSourceId(symbol: string): string {
  return `fundamentals:${symbol}`;
}

/**
 * Fetch fundamental data for a single symbol.
 * Uses Finnhub profile endpoint (works with existing API key).
 */
export async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const finnhubKey = getSecret('FINNHUB_API_KEY');

  const base: Fundamentals = {
    symbol,
    peRatio: null,
    eps: null,
    marketCap: null,
    sector: null,
    industry: null,
    description: null,
    dividendYield: null,
    week52High: null,
    week52Low: null,
    avgVolume: null,
    earningsDate: null,
    fetchedAt: Date.now(),
  };

  if (!finnhubKey) return base;

  try {
    const resp = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`
    );
    if (!resp.ok) return base;

    const data = await resp.json();
    if (!data || data.error) return base;

    return {
      ...base,
      peRatio: data.peRatio ?? data.pe ?? null,
      eps: data.eps ?? null,
      marketCap: data.marketCapitalization
        ? data.marketCapitalization * 1_000_000 // Finnhub returns in millions
        : null,
      sector: data.finnhubIndustry || null,
      industry: data.industry || null,
      description: data.name || null, // Finnhub profile has 'name' not description
      dividendYield: data.dividendYield ?? null,
      week52High: data.week52High ?? null,
      week52Low: data.week52Low ?? null,
      avgVolume: data.averageVolume ?? null,
      earningsDate: data.earningsDate ?? null,
    };
  } catch {
    return base;
  }
}

/**
 * Register a fundamentals source for a specific symbol.
 * Safe to call multiple times — skips if already registered.
 */
export function registerFundamentalsSource(symbol: string): void {
  const id = fundamentalsSourceId(symbol);

  if (dataLayer.hasSource(id)) return;

  dataLayer.registerSource<Fundamentals>({
    id,
    fetch: async () => fetchFundamentals(symbol),
    cache: {
      ttlMs: 3_600_000, // 1hr — fundamentals don't change often
    },
  });
}

/**
 * Ensure fundamentals sources exist for all watchlist symbols.
 * Call after watchlist source is registered.
 */
export function registerFundamentalsForWatchlist(symbols: string[]): void {
  for (const symbol of symbols) {
    registerFundamentalsSource(symbol);
  }
}

/**
 * Get cached fundamentals for a symbol.
 * Returns null if not yet fetched.
 */
export function getFundamentals(symbol: string): Fundamentals | null {
  return dataLayer.getData<Fundamentals>(fundamentalsSourceId(symbol));
}
