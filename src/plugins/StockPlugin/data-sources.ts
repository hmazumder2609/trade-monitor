/**
 * StockPlugin data source declarations.
 *
 * Declares which shared data sources this panel requires and provides.
 * The DataLayer uses this to understand dependencies between panels.
 */

/** Data sources this panel consumes. */
export const requires = ['watchlist', 'market-quotes'] as const;

/** Data sources this panel produces for other panels. */
export const provides = ['market-quotes'] as const;

/** Per-symbol sources this panel registers on-demand. */
export const perSymbolSources = ['market-history', 'fundamentals', 'sentiment'] as const;
