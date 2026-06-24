/**
 * StockPlugin API client.
 *
 * Re-exports DataLayer functions for backward compatibility.
 * All actual data fetching is handled by the DataLayer.
 */

export {
  fetchQuotes,
  searchSymbols,
  fetchCandles,
  getCandles,
  type StockQuote,
  type SymbolSearchResult,
  type Candle,
  type Timeframe,
} from '@/services/data-layer';
