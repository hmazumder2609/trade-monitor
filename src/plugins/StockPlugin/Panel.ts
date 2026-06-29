/**
 * StockPanel — full-featured markets panel with multi-timeframe charts,
 * technical indicators, fundamentals, sentiment, and portfolio context.
 */

import { Panel } from '@/components/Panel';
import {
  dataLayer,
  fetchQuotes,
  searchSymbols,
  WATCHLIST_SOURCE_ID,
  addToWatchlist,
  isInWatchlist,
  type WatchlistEntry,
  type StockQuote,
} from '@/services/data-layer';
import type { SymbolSearchResult } from '@/services/data-layer/sources/market-quotes';
import { getStockSettings, setStockSettings, type StockPanelSettings } from './settings';
import { ChartRow } from './components/ChartRow';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

type StockTab = 'stocks' | 'etfs' | 'crypto' | 'commodities';

interface StockFormSettings {
  defaultTimeframe: string;
  chartType: string;
  indicatorsRsi: boolean;
  indicatorsSma: boolean;
  indicatorsVolume: boolean;
  showFundamentals: boolean;
  showSentiment: boolean;
  showPortfolio: boolean;
}

const ETF_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'ARKK', 'XLF', 'XLE', 'GLD', 'TLT'];
const CRYPTO_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD'];
const COMMODITY_SYMBOLS = ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F'];
const ETF_NAMES: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'Nasdaq 100',
  IWM: 'Russell 2000',
  DIA: 'Dow Jones',
  VTI: 'Total Market',
  ARKK: 'ARK Innovation',
  XLF: 'Financials',
  XLE: 'Energy',
  GLD: 'Gold ETF',
  TLT: '20+ Yr Treasury',
};
const COMMODITY_NAMES: Record<string, string> = {
  'GC=F': 'Gold',
  'SI=F': 'Silver',
  'CL=F': 'Crude Oil',
  'NG=F': 'Natural Gas',
  'HG=F': 'Copper',
};
const CRYPTO_NAMES: Record<string, string> = {
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'BNB-USD': 'BNB',
  'XRP-USD': 'XRP',
};

export class StockPanel extends Panel {
  private activeTab: StockTab;
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private chartRows = new Map<string, ChartRow>();
  private refreshGen = 0;
  private watchlistUnsub: (() => void) | null = null;

  constructor() {
    const settings = getStockSettings();
    super({ id: 'stocks', title: 'Markets', showCount: true, className: '' });
    this.activeTab = settings.defaultTab;
    this.buildLayout();
    this.refresh();

    // Subscribe to watchlist changes
    this.watchlistUnsub = dataLayer.subscribe<WatchlistEntry[]>(WATCHLIST_SOURCE_ID, () => {
      if (this.activeTab === 'stocks') this.refresh();
    });
  }

  // ──────────────────────────────────────────────
  //  Layout
  // ──────────────────────────────────────────────

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'panel-tabs';
    this.renderTabs();
    this.content.appendChild(this.tabsEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'stock-list';
    this.listEl.style.padding = '0 4px 4px';
    this.content.appendChild(this.listEl);

    this.renderAddButton();
  }

  private renderAddButton(): void {
    const header = this.element.querySelector('.panel-header-left');
    if (!header || header.querySelector('.markets-add-btn')) return;

    const addBtn = document.createElement('button');
    addBtn.className = 'finance-add-btn markets-add-btn';
    addBtn.innerHTML = '+';
    addBtn.title = 'Add to watchlist';
    addBtn.addEventListener('click', () => {
      this.showAddBar = !this.showAddBar;
      this.renderAddBar();
    });
    header.appendChild(addBtn);
  }

  private showAddBar = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private renderAddBar(): void {
    let bar = this.content.querySelector('.markets-add-bar') as HTMLElement | null;
    if (!this.showAddBar) {
      bar?.remove();
      return;
    }
    if (bar) return;

    bar = document.createElement('div');
    bar.className = 'markets-add-bar';
    bar.innerHTML = `
      <div class="symbol-search-wrap">
        <input type="text" class="trading-input markets-add-input" placeholder="Search symbol (e.g. NVDA, Bitcoin)" autocomplete="off" />
        <div class="symbol-search-results"></div>
      </div>
    `;
    this.content.insertBefore(bar, this.listEl);

    const input = bar.querySelector('.markets-add-input') as HTMLInputElement;
    const dropdown = bar.querySelector('.symbol-search-results') as HTMLElement;

    const addSymbol = (symbol: string, name?: string) => {
      addToWatchlist(symbol, name);
      input.value = '';
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
      this.showAddBar = false;
      this.renderAddBar();
      this.refresh();
    };

    const showResults = (results: SymbolSearchResult[]) => {
      if (results.length === 0) {
        dropdown.innerHTML = '<div class="symbol-search-empty">No results</div>';
        dropdown.style.display = '';
        return;
      }
      dropdown.innerHTML = results
        .map(
          r => `
        <button class="symbol-search-item ${isInWatchlist(r.symbol) ? 'already-added' : ''}" data-sym="${r.symbol}" data-name="${r.name}">
          <span class="symbol-search-ticker">${r.symbol}</span>
          <span class="symbol-search-name">${r.name}</span>
          <span class="symbol-search-meta">${r.type} · ${r.exchange}</span>
          ${isInWatchlist(r.symbol) ? '<span class="symbol-search-check">&#10003;</span>' : ''}
        </button>
      `
        )
        .join('');
      dropdown.style.display = '';
      dropdown
        .querySelectorAll<HTMLButtonElement>('.symbol-search-item:not(.already-added)')
        .forEach(btn => {
          btn.addEventListener('click', () =>
            addSymbol(btn.dataset.sym!, btn.dataset.name || undefined)
          );
        });
    };

    input.addEventListener('input', () => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      const q = input.value.trim();
      if (!q) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
        return;
      }
      this.searchTimer = setTimeout(async () => {
        const results = await searchSymbols(q);
        showResults(results);
      }, 250);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.showAddBar = false;
        this.renderAddBar();
      }
    });

    input.focus();
  }

  private renderTabs(): void {
    if (!this.tabsEl) return;
    this.tabsEl.innerHTML = '';
    const tabLabels: Record<StockTab, string> = {
      stocks: 'Stocks',
      etfs: 'ETFs',
      crypto: 'Crypto',
      commodities: 'Cmdty',
    };
    for (const tab of ['stocks', 'etfs', 'crypto', 'commodities'] as StockTab[]) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${tab === this.activeTab ? 'active' : ''}`;
      btn.textContent = tabLabels[tab];
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        setStockSettings({ defaultTab: tab });
        this.renderTabs();
        this.refresh();
      });
      this.tabsEl.appendChild(btn);
    }
  }

  // ──────────────────────────────────────────────
  //  Refresh
  // ──────────────────────────────────────────────

  async refresh(): Promise<void> {
    const gen = ++this.refreshGen;
    this.setFetching(true);
    try {
      let symbols: string[] | undefined;
      let nameMap: Record<string, string> = {};

      if (this.activeTab === 'etfs') {
        symbols = ETF_SYMBOLS;
        nameMap = ETF_NAMES;
      } else if (this.activeTab === 'crypto') {
        symbols = CRYPTO_SYMBOLS;
        nameMap = CRYPTO_NAMES;
      } else if (this.activeTab === 'commodities') {
        symbols = COMMODITY_SYMBOLS;
        nameMap = COMMODITY_NAMES;
      }

      const quotes = await fetchQuotes(symbols || []);
      if (gen !== this.refreshGen) return;

      // Apply name overrides
      if (Object.keys(nameMap).length > 0) {
        for (const q of quotes) {
          if (nameMap[q.symbol]) q.name = nameMap[q.symbol];
        }
      }

      this.render(quotes);
      this.setCount(quotes.length);
      this.setDataBadge('live');
    } catch {
      if (gen !== this.refreshGen) return;
      this.showError('Failed to load market data', () => this.refresh());
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  // ──────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────

  private render(quotes: StockQuote[]): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    this.chartRows.clear();

    for (const q of quotes) {
      const row = new ChartRow(q);
      this.chartRows.set(q.symbol, row);
      this.listEl.appendChild(row.getElement());
    }
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const settings = getStockSettings();

    const formSettings: StockFormSettings = {
      defaultTimeframe: settings.defaultTimeframe,
      chartType: settings.chartType,
      indicatorsRsi: settings.indicators.rsi,
      indicatorsSma: settings.indicators.sma20,
      indicatorsVolume: settings.indicators.volume,
      showFundamentals: settings.showFundamentals,
      showSentiment: settings.showSentiment,
      showPortfolio: settings.showPortfolio,
    };

    const schema: SettingSchema<StockFormSettings>[] = [
      {
        key: 'defaultTimeframe',
        label: 'Default TF',
        type: 'select',
        options: [
          { value: '5m', label: '5m' },
          { value: '15m', label: '15m' },
          { value: '1H', label: '1H' },
          { value: '1D', label: '1D' },
          { value: '1W', label: '1W' },
          { value: '1M', label: '1M' },
        ],
      },
      {
        key: 'chartType',
        label: 'Chart type',
        type: 'select',
        options: [
          { value: 'candlestick', label: 'Candles' },
          { value: 'line', label: 'Line' },
          { value: 'area', label: 'Area' },
        ],
      },
      { key: 'indicatorsRsi', label: 'Show RSI', type: 'checkbox' },
      { key: 'indicatorsSma', label: 'Show MA(20/50/200)', type: 'checkbox' },
      { key: 'indicatorsVolume', label: 'Show volume', type: 'checkbox' },
      { key: 'showFundamentals', label: 'Fundamentals', type: 'checkbox' },
      { key: 'showSentiment', label: 'Sentiment', type: 'checkbox' },
      { key: 'showPortfolio', label: 'Portfolio', type: 'checkbox' },
    ];

    return createSettingsForm<StockFormSettings>({
      title: 'Markets Settings',
      schema,
      initialValues: formSettings,
      onChange: vals => {
        setStockSettings({
          defaultTimeframe: vals.defaultTimeframe as StockPanelSettings['defaultTimeframe'],
          chartType: vals.chartType as StockPanelSettings['chartType'],
          indicators: {
            ...settings.indicators,
            rsi: vals.indicatorsRsi,
            sma20: vals.indicatorsSma,
            sma50: vals.indicatorsSma,
            sma200: vals.indicatorsSma,
            volume: vals.indicatorsVolume,
          },
          showFundamentals: vals.showFundamentals,
          showSentiment: vals.showSentiment,
          showPortfolio: vals.showPortfolio,
        });
      },
    });
  }

  // ──────────────────────────────────────────────
  //  Cross-panel symbol selection
  // ──────────────────────────────────────────────

  public onSymbolSelect(symbol: string): void {
    // Expand the row for the selected symbol
    const row = this.chartRows.get(symbol);
    if (row) {
      row.getElement().scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ──────────────────────────────────────────────
  //  Cleanup
  // ──────────────────────────────────────────────

  public destroy(): void {
    this.watchlistUnsub?.();
    super.destroy();
  }
}
