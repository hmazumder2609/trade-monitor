/**
 * StockPlugin panel-specific settings.
 *
 * Stored in localStorage under `mdm-panel-stocks`.
 * Each panel owns its own settings — no global config dependency.
 */

const STORAGE_KEY = 'mdm-panel-stocks';

export type ChartType = 'candlestick' | 'line' | 'area';
export type DefaultTimeframe = '5m' | '15m' | '1H' | '1D' | '1W' | '1M';

export interface StockPanelSettings {
  /** Default timeframe for new symbol expansions. */
  defaultTimeframe: DefaultTimeframe;
  /** Chart rendering style. */
  chartType: ChartType;
  /** Which technical indicators to show on charts. */
  indicators: {
    sma20: boolean;
    sma50: boolean;
    sma200: boolean;
    rsi: boolean;
    macd: boolean;
    bollinger: boolean;
    volume: boolean;
  };
  /** Show fundamental data bar below each chart. */
  showFundamentals: boolean;
  /** Show sentiment badge for each symbol. */
  showSentiment: boolean;
  /** Show portfolio context (weight, P&L) if connected. */
  showPortfolio: boolean;
  /** Auto-refresh interval in milliseconds. */
  refreshIntervalMs: number;
  /** Which tab is active by default. */
  defaultTab: 'stocks' | 'etfs' | 'crypto' | 'commodities';
  /** Show sparklines in collapsed rows. */
  showSparklines: boolean;
  /** Show change percentage in collapsed rows. */
  showChangePercent: boolean;
}

export const DEFAULT_SETTINGS: StockPanelSettings = {
  defaultTimeframe: '1D',
  chartType: 'candlestick',
  indicators: {
    sma20: true,
    sma50: true,
    sma200: true,
    rsi: true,
    macd: false,
    bollinger: false,
    volume: true,
  },
  showFundamentals: true,
  showSentiment: true,
  showPortfolio: true,
  refreshIntervalMs: 60_000,
  defaultTab: 'stocks',
  showSparklines: true,
  showChangePercent: true,
};

/**
 * Get panel settings from localStorage, merged with defaults.
 */
export function getStockSettings(): StockPanelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        indicators: { ...DEFAULT_SETTINGS.indicators, ...saved.indicators },
      };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/**
 * Partially update panel settings.
 */
export function setStockSettings(partial: Partial<StockPanelSettings>): void {
  const current = getStockSettings();
  const merged: StockPanelSettings = {
    ...current,
    ...partial,
    indicators: {
      ...current.indicators,
      ...(partial.indicators || {}),
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

/**
 * Reset to default settings.
 */
export function resetStockSettings(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
}
