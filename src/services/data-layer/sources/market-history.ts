/**
 * Market history data source — OHLCV candles for charting.
 *
 * Per-symbol, per-timeframe sources (e.g., `market-history:AAPL:1D`).
 * Fetches from `/api/chart` endpoint.
 */

import { dataLayer } from '../DataLayer';
import { getSecret } from '@/services/settings-store';

export type Timeframe = '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M';

export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketHistory {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
}

/** Cache TTL per timeframe (shorter for intraday, longer for daily+). */
const TIMEFRAME_TTL: Record<Timeframe, number> = {
  '5m': 60_000, // 1min
  '15m': 120_000, // 2min
  '1H': 300_000, // 5min
  '4H': 600_000, // 10min
  '1D': 3_600_000, // 1hr
  '1W': 14_400_000, // 4hr
  '1M': 86_400_000, // 1day
};

/**
 * Generate a DataLayer source ID for a symbol+timeframe combination.
 */
export function historySourceId(symbol: string, tf: Timeframe): string {
  return `market-history:${symbol}:${tf}`;
}

/**
 * Fetch OHLCV candles for a symbol and timeframe.
 */
export async function fetchCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const apiKey = getSecret('FINNHUB_API_KEY');

  try {
    const params = new URLSearchParams({ symbol, tf });
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-Finnhub-Key'] = apiKey;

    const resp = await fetch(`/api/chart?${params}`, { headers });
    if (!resp.ok) return [];

    const data = await resp.json();
    return (data.candles || []).map((c: Record<string, unknown>) => ({
      time: (c.time as number) / 1000, // Convert ms to seconds for Lightweight Charts
      open: c.open as number,
      high: c.high as number,
      low: c.low as number,
      close: c.close as number,
      volume: (c.volume as number) || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Register a history source for a specific symbol+timeframe.
 * Safe to call multiple times — skips if already registered.
 */
export function registerHistorySource(symbol: string, tf: Timeframe): void {
  const id = historySourceId(symbol, tf);

  if (dataLayer.hasSource(id)) return;

  dataLayer.registerSource<MarketHistory>({
    id,
    fetch: async () => {
      const candles = await fetchCandles(symbol, tf);
      return { symbol, timeframe: tf, candles };
    },
    cache: {
      ttlMs: TIMEFRAME_TTL[tf],
    },
  });
}

/**
 * Ensure history sources exist for common timeframes of a symbol.
 */
export function registerHistorySources(symbol: string, timeframes?: Timeframe[]): void {
  const tfs = timeframes || ['5m', '15m', '1H', '1D', '1W', '1M'];
  for (const tf of tfs) {
    registerHistorySource(symbol, tf);
  }
}

/**
 * Get cached candle data for a symbol+timeframe.
 * Returns null if not yet fetched.
 */
export function getCandles(symbol: string, tf: Timeframe): Candle[] | null {
  const history = dataLayer.getData<MarketHistory>(historySourceId(symbol, tf));
  return history?.candles ?? null;
}
