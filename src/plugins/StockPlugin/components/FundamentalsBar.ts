/**
 * FundamentalsBar — displays key fundamental metrics for a symbol.
 *
 * Shows P/E, EPS, Market Cap, Sector, and 52-week range.
 * Data comes from the DataLayer fundamentals source.
 */

import {
  registerFundamentalsSource,
  getFundamentals,
  type Fundamentals,
} from '@/services/data-layer/sources/fundamentals';

export class FundamentalsBar {
  private el: HTMLElement;
  private symbol: string;
  private data: Fundamentals | null = null;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.el = document.createElement('div');
    this.el.className = 'stock-fundamentals-bar';
    this.render();
  }

  getElement(): HTMLElement {
    return this.el;
  }

  async load(): Promise<void> {
    registerFundamentalsSource(this.symbol);
    this.data = getFundamentals(this.symbol);

    if (!this.data) {
      // Fetch if not cached yet
      const { fetchFundamentals } = await import('@/services/data-layer/sources/fundamentals');
      this.data = await fetchFundamentals(this.symbol);
    }

    this.render();
  }

  private render(): void {
    if (!this.data) {
      this.el.innerHTML = '<span class="stock-fundamentals-loading">Loading fundamentals...</span>';
      return;
    }

    const d = this.data;
    const items: string[] = [];

    if (d.peRatio != null) {
      items.push(
        `<span class="stock-fund-item"><span class="stock-fund-label">P/E</span> ${d.peRatio.toFixed(1)}</span>`
      );
    }
    if (d.eps != null) {
      items.push(
        `<span class="stock-fund-item"><span class="stock-fund-label">EPS</span> $${d.eps.toFixed(2)}</span>`
      );
    }
    if (d.marketCap != null) {
      items.push(
        `<span class="stock-fund-item"><span class="stock-fund-label">MCap</span> ${formatMarketCap(d.marketCap)}</span>`
      );
    }
    if (d.sector) {
      items.push(
        `<span class="stock-fund-item"><span class="stock-fund-label">Sector</span> ${d.sector}</span>`
      );
    }
    if (d.week52High != null && d.week52Low != null) {
      items.push(
        `<span class="stock-fund-item"><span class="stock-fund-label">52w</span> ${d.week52Low.toFixed(0)} – ${d.week52High.toFixed(0)}</span>`
      );
    }
    if (d.dividendYield != null && d.dividendYield > 0) {
      items.push(
        `<span class="stock-fund-item"><span class="stock-fund-label">Yield</span> ${d.dividendYield.toFixed(2)}%</span>`
      );
    }

    this.el.innerHTML = items.length > 0 ? items.join('<span class="stock-fund-sep">|</span>') : '';
  }
}

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}
