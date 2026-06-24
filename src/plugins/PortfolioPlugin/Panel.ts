import { Panel } from '@/components/Panel';
import {
  dataLayer,
  fetchQuotes,
  PORTFOLIO_SOURCE_ID,
  type StockQuote,
  type PortfolioSummary,
} from '@/services/data-layer';
import { isSnapTradeConfigured, getSnapTradeUser } from '@/services/snaptrade';
import { formatPrice, formatChange, getChangeClass } from '@/utils';

const PORTFOLIO_KEY = 'mdm-portfolio-manual';
const SETTINGS_KEY = 'mdm-portfolio-settings';

interface PortfolioSettings {
  sortBy: 'value' | 'return' | 'dayChange' | 'symbol';
  showAllocation: boolean;
  showDayChange: boolean;
}

const DEFAULT_SETTINGS: PortfolioSettings = {
  sortBy: 'value',
  showAllocation: true,
  showDayChange: true,
};

function loadManualPositions(): Array<{ symbol: string; qty: number; avgCost: number }> {
  try {
    return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveManualPositions(
  positions: Array<{ symbol: string; qty: number; avgCost: number }>
): void {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(positions));
}

export class PortfolioPanel extends Panel {
  private holdings: Array<{
    symbol: string;
    name: string;
    qty: number;
    avgCost: number;
    currentPrice: number;
    value: number;
    dayChange: number;
    dayChangePct: number;
    totalReturn: number;
    totalReturnPct: number;
    allocation: number;
    source: 'snaptrade' | 'watchlist';
  }> = [];
  private totalValue = 0;
  private totalDayChange = 0;
  private totalBuyingPower = 0;
  private totalCash = 0;
  private showAddForm = false;
  private settings: PortfolioSettings = this.loadSettings();

  private loadSettings(): PortfolioSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  constructor() {
    super({ id: 'finance', title: 'Portfolio' });
    this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.isFetching) return;
    this.setFetching(true);
    try {
      await this.loadPortfolio();
      this.render();
      if (this.holdings.length > 0) this.setDataBadge('live');
    } catch {
      this.showError('Failed to load portfolio', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private async loadPortfolio(): Promise<void> {
    const holdings: Array<{
      symbol: string;
      name: string;
      qty: number;
      avgCost: number;
      currentPrice: number;
      value: number;
      dayChange: number;
      dayChangePct: number;
      totalReturn: number;
      totalReturnPct: number;
      allocation: number;
      source: 'snaptrade' | 'watchlist';
    }> = [];
    const snapSymbols: string[] = [];

    // Load SnapTrade positions from DataLayer
    if (isSnapTradeConfigured() && getSnapTradeUser()) {
      try {
        // Ensure portfolio source is registered and fetch fresh data
        const portfolio = dataLayer.getData<PortfolioSummary>(PORTFOLIO_SOURCE_ID);
        if (!portfolio) {
          const { fetchPortfolio } = await import('@/services/data-layer/sources/portfolio');
          await fetchPortfolio();
        }
        const portfolioData = dataLayer.getData<PortfolioSummary>(PORTFOLIO_SOURCE_ID);

        if (portfolioData && portfolioData.positions.length > 0) {
          for (const pos of portfolioData.positions) {
            snapSymbols.push(pos.symbol);
            holdings.push({
              symbol: pos.symbol,
              name: pos.symbol, // Portfolio source doesn't have names, use symbol
              qty: pos.quantity,
              avgCost: pos.averageCost,
              currentPrice: pos.currentPrice,
              value: pos.marketValue,
              dayChange: pos.dayPnl,
              dayChangePct: pos.dayPnlPercent,
              totalReturn: pos.unrealizedPnl,
              totalReturnPct: pos.unrealizedPnlPercent,
              allocation: pos.weight,
              source: 'snaptrade',
            });
          }
        }
      } catch {}
    }

    const manual = loadManualPositions();
    const manualSymbols = manual.map(p => p.symbol);
    const allSymbols = [...new Set([...snapSymbols, ...manualSymbols])];
    let quoteMap = new Map<string, StockQuote>();
    if (allSymbols.length > 0) {
      try {
        const quotes = await fetchQuotes(allSymbols);
        quoteMap = new Map(quotes.map(q => [q.symbol, q]));
      } catch {}
    }

    for (const h of holdings) {
      const q = quoteMap.get(h.symbol);
      if (q) {
        h.currentPrice = q.price ?? h.currentPrice;
        h.value = h.qty * h.currentPrice;
        h.dayChange = (q.change ?? 0) * h.qty;
        h.dayChangePct = q.changePercent ?? 0;
        h.totalReturn = (h.currentPrice - h.avgCost) * h.qty;
        h.totalReturnPct = h.avgCost > 0 ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0;
      }
    }

    for (const pos of manual) {
      const q = quoteMap.get(pos.symbol);
      const price = q?.price ?? 0;
      holdings.push({
        symbol: pos.symbol,
        name: q?.name || pos.symbol,
        qty: pos.qty,
        avgCost: pos.avgCost,
        currentPrice: price,
        value: pos.qty * price,
        dayChange: (q?.change ?? 0) * pos.qty,
        dayChangePct: q?.changePercent ?? 0,
        totalReturn: (price - pos.avgCost) * pos.qty,
        totalReturnPct: pos.avgCost > 0 ? ((price - pos.avgCost) / pos.avgCost) * 100 : 0,
        allocation: 0,
        source: 'watchlist',
      });
    }

    const total = holdings.reduce((s, h) => s + h.value, 0);
    for (const h of holdings) {
      h.allocation = total > 0 ? (h.value / total) * 100 : 0;
    }

    this.holdings = this.sortHoldings(holdings);
    this.totalValue = total;
    this.totalDayChange = holdings.reduce((s, h) => s + h.dayChange, 0);
  }

  private render(): void {
    this.updateHeaderWithAddButton();

    const dayPct =
      this.totalValue > 0
        ? (this.totalDayChange / (this.totalValue - this.totalDayChange)) * 100
        : 0;
    const dayClass = dayPct >= 0 ? 'positive' : 'negative';

    if (this.holdings.length === 0 && !this.showAddForm) {
      this.setContent(`
        <div class="portfolio-empty">
          <div class="portfolio-empty-icon">📊</div>
          <div class="portfolio-empty-text">No positions yet</div>
          <div class="portfolio-empty-hint">
            Add positions manually with the <strong>+</strong> button, or connect a brokerage via SnapTrade in the Trading tab.
          </div>
        </div>
      `);
      return;
    }

    const cashRow =
      this.totalCash > 0 || this.totalBuyingPower > 0
        ? `
        <div class="portfolio-balances">
          <div class="portfolio-balance"><span class="portfolio-bal-label">Cash</span><span class="portfolio-bal-value">${formatPrice(this.totalCash)}</span></div>
          <div class="portfolio-balance"><span class="portfolio-bal-label">Buying Power</span><span class="portfolio-bal-value">${formatPrice(this.totalBuyingPower)}</span></div>
        </div>
      `
        : '';

    const summary = `
      <div class="portfolio-summary">
        <div class="portfolio-total">
          <span class="portfolio-total-label">Portfolio Value</span>
          <span class="portfolio-total-value">${formatPrice(this.totalValue)}</span>
        </div>
        ${cashRow}
        ${
          this.settings.showDayChange
            ? `
        <div class="portfolio-day-change ${dayClass}">
          <span class="portfolio-day-label">Day P&L</span>
          <span class="portfolio-day-value">${dayPct >= 0 ? '+' : ''}${formatPrice(this.totalDayChange)} (${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%)</span>
        </div>
        `
            : ''
        }
      </div>
    `;

    const allocBar =
      this.holdings.length > 1 && this.settings.showAllocation
        ? `
      <div class="portfolio-alloc-bar">
        ${this.holdings
          .map((h, i) => {
            const colors = [
              '#44ff88',
              '#3b82f6',
              '#ff8800',
              '#ff4444',
              '#a855f7',
              '#f59e0b',
              '#06b6d4',
              '#ec4899',
            ];
            return `<div class="portfolio-alloc-seg" style="width:${h.allocation}%;background:${colors[i % colors.length]}" title="${h.symbol}: ${h.allocation.toFixed(1)}%"></div>`;
          })
          .join('')}
      </div>
    `
        : '';

    const rows = this.holdings
      .map(h => {
        const retClass = getChangeClass(h.totalReturnPct);
        const dayClass = getChangeClass(h.dayChangePct);
        return `
        <div class="portfolio-row">
          <div class="portfolio-row-left">
            <span class="portfolio-sym">${h.symbol}</span>
            <span class="portfolio-qty">${h.qty} shares</span>
          </div>
          <div class="portfolio-row-mid">
            <span class="portfolio-price">${formatPrice(h.currentPrice)}</span>
            ${this.settings.showDayChange ? `<span class="portfolio-day-chg ${dayClass}">${formatChange(h.dayChangePct)}</span>` : ''}
          </div>
          <div class="portfolio-row-right">
            <span class="portfolio-value">${formatPrice(h.value)}</span>
            <span class="portfolio-return ${retClass}">${h.totalReturn >= 0 ? '+' : ''}${formatPrice(h.totalReturn)}</span>
          </div>
          ${h.source === 'watchlist' ? `<button class="portfolio-remove" data-sym="${h.symbol}" title="Remove">&times;</button>` : ''}
        </div>
      `;
      })
      .join('');

    const addForm = this.showAddForm
      ? `
      <div class="portfolio-add-form">
        <div class="portfolio-add-title">Add Position</div>
        <div class="portfolio-add-fields">
          <input class="trading-input" id="portSymbol" placeholder="Symbol" style="width:80px" />
          <input class="trading-input" id="portQty" type="number" placeholder="Qty" min="1" step="1" style="width:60px" />
          <input class="trading-input" id="portCost" type="number" placeholder="Avg Cost" step="0.01" style="width:80px" />
          <button class="trading-btn" id="portAddBtn" style="background:var(--green);color:var(--bg);font-weight:700;">Add</button>
          <button class="trading-btn trading-btn-outline" id="portCancelBtn">Cancel</button>
        </div>
      </div>
    `
      : '';

    this.setContent(`${summary}${allocBar}${addForm}<div class="portfolio-list">${rows}</div>`);

    this.wireEvents();
  }

  private updateHeaderWithAddButton(): void {
    const header = this.element.querySelector('.panel-header-left');
    if (!header) return;
    const existing = header.querySelector('.finance-add-btn');
    if (existing) existing.remove();

    const addBtn = document.createElement('button');
    addBtn.className = 'finance-add-btn';
    addBtn.innerHTML = '+';
    addBtn.title = 'Add Position';
    addBtn.addEventListener('click', () => {
      this.showAddForm = !this.showAddForm;
      this.render();
    });
    header.appendChild(addBtn);
  }

  private wireEvents(): void {
    const content = this.element.querySelector('.panel-content');
    if (!content) return;

    content.querySelector('#portAddBtn')?.addEventListener('click', () => {
      const symbol = (content.querySelector('#portSymbol') as HTMLInputElement)?.value
        .trim()
        .toUpperCase();
      const qty = parseInt((content.querySelector('#portQty') as HTMLInputElement)?.value || '0');
      const cost = parseFloat(
        (content.querySelector('#portCost') as HTMLInputElement)?.value || '0'
      );
      if (!symbol || qty <= 0) return;

      const positions = loadManualPositions();
      const existing = positions.find(p => p.symbol === symbol);
      if (existing) {
        const totalQty = existing.qty + qty;
        existing.avgCost = (existing.avgCost * existing.qty + cost * qty) / totalQty;
        existing.qty = totalQty;
      } else {
        positions.push({ symbol, qty, avgCost: cost });
      }
      saveManualPositions(positions);
      this.showAddForm = false;
      this.refresh();
    });

    content.querySelector('#portCancelBtn')?.addEventListener('click', () => {
      this.showAddForm = false;
      this.render();
    });

    content.querySelectorAll<HTMLButtonElement>('.portfolio-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.sym;
        if (!sym) return;
        const positions = loadManualPositions().filter(p => p.symbol !== sym);
        saveManualPositions(positions);
        this.refresh();
      });
    });
  }

  private sortHoldings(
    holdings: Array<{
      symbol: string;
      name: string;
      qty: number;
      avgCost: number;
      currentPrice: number;
      value: number;
      dayChange: number;
      dayChangePct: number;
      totalReturn: number;
      totalReturnPct: number;
      allocation: number;
      source: 'snaptrade' | 'watchlist';
    }>
  ): typeof holdings {
    const sorted = [...holdings];
    switch (this.settings.sortBy) {
      case 'return':
        sorted.sort((a, b) => b.totalReturnPct - a.totalReturnPct);
        break;
      case 'dayChange':
        sorted.sort((a, b) => b.dayChangePct - a.dayChangePct);
        break;
      case 'symbol':
        sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
      case 'value':
      default:
        sorted.sort((a, b) => b.value - a.value);
        break;
    }
    return sorted;
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Portfolio Settings</div>
      <div class="social-settings-label">
        <span>Sort holdings by</span>
        <select class="social-settings-select" id="portfolioSort">
          <option value="value" ${this.settings.sortBy === 'value' ? 'selected' : ''}>Value</option>
          <option value="return" ${this.settings.sortBy === 'return' ? 'selected' : ''}>Return</option>
          <option value="dayChange" ${this.settings.sortBy === 'dayChange' ? 'selected' : ''}>Day Change</option>
          <option value="symbol" ${this.settings.sortBy === 'symbol' ? 'selected' : ''}>Symbol</option>
        </select>
      </div>
      <label class="social-settings-label">
        <input type="checkbox" id="portfolioShowAlloc" ${this.settings.showAllocation ? 'checked' : ''} />
        Show allocation percentages
      </label>
      <label class="social-settings-label">
        <input type="checkbox" id="portfolioShowDay" ${this.settings.showDayChange ? 'checked' : ''} />
        Show day change
      </label>
    `;

    el.addEventListener('change', () => {
      const sortBy = (el.querySelector('#portfolioSort') as HTMLSelectElement)
        .value as PortfolioSettings['sortBy'];
      const showAllocation = (el.querySelector('#portfolioShowAlloc') as HTMLInputElement).checked;
      const showDayChange = (el.querySelector('#portfolioShowDay') as HTMLInputElement).checked;

      this.settings = { sortBy, showAllocation, showDayChange };
      this.saveSettings();
      this.refresh();
    });

    return el;
  }
}
