/**
 * PortfolioPanel — Shows portfolio summary from connected brokerage accounts
 * (via SnapTrade) and watchlist positions.
 *
 * Replaces the old Daily Finance panel with trading-relevant data:
 * - Total portfolio value + day P&L
 * - Holdings breakdown with allocation %
 * - Watchlist performance overview
 */
import { Panel } from './Panel';
import { fetchStockQuotes, type StockQuote } from '@/services/stock-market';
import { isSnapTradeConfigured, getSnapTradeUser } from '@/services/snaptrade';
import { positionManager } from '@/agents/trading';
import { formatPrice, formatChange, getChangeClass } from '@/utils';

const PORTFOLIO_KEY = 'mdm-portfolio-manual';

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

interface AccountBalanceExt {
  cash: number;
  cashCurrency: string;
  buyingPower: number;
  buyingPowerCurrency: string;
  portfolioValue: number;
  currency: string;
  accountId: string;
  accountName: string;
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
  private accountBalances: AccountBalanceExt[] = [];
  private showAddForm = false;

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
    const balances: AccountBalanceExt[] = [];
    let totalCashTotal = 0;
    let totalBuyingPowerTotal = 0;

    if (isSnapTradeConfigured() && getSnapTradeUser()) {
      try {
        const positions = await positionManager.getAllPositions();
        for (const acct of positions) {
          balances.push({
            ...acct.balances,
            accountId: acct.accountId,
            accountName: acct.accountName,
          });
          totalCashTotal += acct.balances.cash;
          totalBuyingPowerTotal += acct.balances.buyingPower;
          for (const pos of acct.positions) {
            snapSymbols.push(pos.symbol);
            holdings.push({
              symbol: pos.symbol,
              name: pos.description || pos.symbol,
              qty: pos.qty,
              avgCost: pos.avgCost,
              currentPrice: pos.currentPrice,
              value: pos.value,
              dayChange: 0,
              dayChangePct: 0,
              totalReturn: pos.unrealizedPnl,
              totalReturnPct: pos.unrealizedPnlPct,
              allocation: 0,
              source: 'snaptrade',
            });
          }
        }
      } catch {
        /* SnapTrade unavailable */
      }
    }

    this.accountBalances = balances;
    this.totalCash = totalCashTotal;
    this.totalBuyingPower = totalBuyingPowerTotal;

    // 2. Load manual positions
    const manual = loadManualPositions();
    const manualSymbols = manual.map(p => p.symbol);

    // 3. Fetch live quotes for all symbols (SnapTrade + manual) to get day change
    const allSymbols = [...new Set([...snapSymbols, ...manualSymbols])];
    let quoteMap = new Map<string, StockQuote>();
    if (allSymbols.length > 0) {
      try {
        const quotes = await fetchStockQuotes(allSymbols);
        quoteMap = new Map(quotes.map(q => [q.symbol, q]));
      } catch {
        /* quotes unavailable */
      }
    }

    // Enrich SnapTrade holdings with live day-change data
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

    // Add manual positions
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

    // Calculate allocations
    const total = holdings.reduce((s, h) => s + h.value, 0);
    for (const h of holdings) {
      h.allocation = total > 0 ? (h.value / total) * 100 : 0;
    }

    this.holdings = holdings.sort((a, b) => b.value - a.value);
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
        <div class="portfolio-day-change ${dayClass}">
          <span class="portfolio-day-label">Day P&L</span>
          <span class="portfolio-day-value">${dayPct >= 0 ? '+' : ''}${formatPrice(this.totalDayChange)} (${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%)</span>
        </div>
      </div>
    `;

    // Allocation bar
    const allocBar =
      this.holdings.length > 1
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
            const color = colors[i % colors.length];
            return `<div class="portfolio-alloc-seg" style="width:${h.allocation}%;background:${color}" title="${h.symbol}: ${h.allocation.toFixed(1)}%"></div>`;
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
            <span class="portfolio-day-chg ${dayClass}">${formatChange(h.dayChangePct)}</span>
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

    this.setContent(`
      ${summary}
      ${allocBar}
      ${addForm}
      <div class="portfolio-list">${rows}</div>
    `);

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

    // Add position
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
        // Average in
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

    // Remove position
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
}
