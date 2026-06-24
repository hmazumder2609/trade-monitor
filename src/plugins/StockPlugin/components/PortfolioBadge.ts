/**
 * PortfolioBadge — shows portfolio context for a symbol.
 *
 * Displays weight in portfolio, unrealized P&L, and day P&L.
 * Only visible when SnapTrade is connected and the symbol is held.
 */

import {
  getSymbolPortfolioContext,
  type PortfolioPosition,
} from '@/services/data-layer/sources/portfolio';

export class PortfolioBadge {
  private el: HTMLElement;
  private symbol: string;
  private position: PortfolioPosition | null = null;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.el = document.createElement('span');
    this.el.className = 'stock-portfolio-badge';
    this.load();
  }

  getElement(): HTMLElement {
    return this.el;
  }

  load(): void {
    this.position = getSymbolPortfolioContext(this.symbol);
    this.render();
  }

  private render(): void {
    if (!this.position) {
      this.el.innerHTML = '';
      this.el.style.display = 'none';
      return;
    }

    this.el.style.display = '';
    const p = this.position;
    const pnlColor = p.unrealizedPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const dayColor = p.dayPnl >= 0 ? 'var(--green)' : 'var(--red)';

    this.el.innerHTML = `
      <span class="stock-portfolio-weight" title="Portfolio weight">
        ${p.weight.toFixed(1)}%
      </span>
      <span class="stock-portfolio-pnl" style="color: ${pnlColor}" title="Unrealized P&L: $${p.unrealizedPnl.toFixed(0)}">
        ${p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnlPercent.toFixed(1)}%
      </span>
      <span class="stock-portfolio-day" style="color: ${dayColor}" title="Day P&L: $${p.dayPnl.toFixed(0)}">
        ${p.dayPnl >= 0 ? '+' : ''}${p.dayPnlPercent.toFixed(1)}%
      </span>
    `;
  }
}
