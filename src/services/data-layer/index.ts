/**
 * Data Layer — shared data infrastructure for cross-panel data sharing.
 *
 * Usage:
 *   import { dataLayer, registerAllSources } from '@/services/data-layer';
 *
 *   // Register all sources at app startup
 *   registerAllSources();
 *
 *   // Subscribe to a source in a panel
 *   const unsub = dataLayer.subscribe('watchlist', (watchlist) => {
 *     renderWatchlist(watchlist);
 *   });
 *
 *   // Get cached data synchronously
 *   const quotes = dataLayer.getData('market-quotes');
 *
 *   // Fetch fresh data
 *   await dataLayer.fetch('market-quotes');
 *
 *   // Cross-panel symbol selection
 *   dataLayer.selectSymbol('AAPL');
 *   dataLayer.onSymbolChange((symbol) => { /* react *\/ });
 */

// Core
export { DataLayer, dataLayer } from './DataLayer';
export type {
  DataSource,
  DataSourceConfig,
  Subscriber,
  DataMetadata,
  DataLayerEvent,
  CacheConfig,
} from './types';

// Sources
export {
  WATCHLIST_SOURCE_ID,
  registerWatchlistSource,
  getWatchlist,
  getWatchlistSymbols,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistTags,
  isInWatchlist,
  setWatchlist,
  syncWatchlistToBridge,
  type WatchlistEntry,
} from './sources/watchlist';

export {
  MARKET_QUOTES_SOURCE_ID,
  registerMarketQuotesSource,
  fetchQuotes,
  searchSymbols,
  type StockQuote,
  type SymbolSearchResult,
} from './sources/market-quotes';

export {
  historySourceId,
  registerHistorySource,
  registerHistorySources,
  fetchCandles,
  getCandles,
  type Timeframe,
  type Candle,
  type MarketHistory,
} from './sources/market-history';

export {
  fundamentalsSourceId,
  registerFundamentalsSource,
  registerFundamentalsForWatchlist,
  fetchFundamentals,
  getFundamentals,
  type Fundamentals,
} from './sources/fundamentals';

export {
  sentimentSourceId,
  registerSentimentSource,
  registerSentimentForWatchlist,
  fetchSentiment,
  getSentiment,
  type SentimentData,
} from './sources/sentiment';

export {
  PORTFOLIO_SOURCE_ID,
  registerPortfolioSource,
  fetchPortfolio,
  getSymbolPortfolioContext,
  getPortfolioSymbols,
  type PortfolioPosition,
  type PortfolioSummary,
} from './sources/portfolio';

export {
  SOCIAL_SENTIMENT_SOURCE_ID,
  registerSocialSentimentSource,
  fetchSocialSentiment,
  type MentionCount,
  type SocialSentimentData,
} from './sources/social-sentiment';

export {
  REDDIT_PULSE_SOURCE_ID,
  registerRedditPulseSource,
  fetchRedditPulse,
  type RedditPost,
  type RedditMention,
  type RedditBreakout,
  type RedditPulseData,
} from './sources/reddit-pulse';

export {
  X_WATCH_SOURCE_ID,
  registerXWatchSource,
  fetchXWatch,
  type XTweet,
  type XWatchMention,
  type XWatchData,
} from './sources/x-watch';

// ──────────────────────────────────────────────
//  Convenience: register all core sources at once
// ──────────────────────────────────────────────

import { registerWatchlistSource } from './sources/watchlist';
import { registerMarketQuotesSource } from './sources/market-quotes';
import { registerPortfolioSource } from './sources/portfolio';
import { registerSocialSentimentSource } from './sources/social-sentiment';
import { registerRedditPulseSource } from './sources/reddit-pulse';
import { registerXWatchSource } from './sources/x-watch';

/**
 * Register all core data sources at app startup.
 * Call this once in main.ts before mounting panels.
 */
export function registerAllSources(): void {
  registerWatchlistSource();
  registerMarketQuotesSource();
  registerPortfolioSource();
  registerSocialSentimentSource();
  registerRedditPulseSource();
  registerXWatchSource();
  // Note: per-symbol sources (history, fundamentals, sentiment) are registered
  // on-demand by panels that need them.
}
