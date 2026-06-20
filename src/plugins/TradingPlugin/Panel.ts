import { Panel } from '@/components/Panel';
import { getStockSymbols } from '@/services/settings-store';

function getTerminalUrl(symbol?: string): string {
  const base =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : '/terminal';
  return symbol ? `${base}?symbol=${encodeURIComponent(symbol)}` : base;
}

const VIEWS = [
  { code: 'MRKT', label: 'Market Overview', desc: 'Gainers · losers · most active' },
  { code: 'CHRT', label: 'Chart', desc: 'lightweight-charts · OHLCV · multi-timeframe' },
  { code: 'SCRN', label: 'Screener', desc: 'Filter by sector · P/E · volume' },
  { code: 'ECON', label: 'Economics', desc: 'Calendar · indicators · Fed events' },
  { code: 'AI', label: 'AI Agent', desc: 'Claude-powered financial analysis' },
  { code: 'PORT', label: 'Portfolio', desc: 'P&L · benchmark · analytics' },
];

export class TradingPanel extends Panel {
  constructor() {
    super({ id: 'trading', title: 'Trading Terminal', className: 'panel-wide' });
    this.render();
  }

  private render(): void {
    const symbols = getStockSymbols().slice(0, 8);
    const defaultSymbol = symbols[0] ?? 'AAPL';

    const viewRows = VIEWS.map(
      v => `
      <div class="terminal-launch-view">
        <span class="terminal-launch-code">${v.code}</span>
        <span class="terminal-launch-label">${v.label}</span>
        <span class="terminal-launch-desc">${v.desc}</span>
      </div>`
    ).join('');

    const symbolPills = symbols
      .map(
        sym => `
      <button class="terminal-sym-pill" data-symbol="${sym}" title="Open terminal with ${sym}">
        ${sym}
      </button>`
      )
      .join('');

    this.content.innerHTML = `
      <div class="terminal-launch">
        <div class="terminal-launch-brand">
          <div class="terminal-launch-logo">
            <span class="terminal-launch-logo-icon">▮</span>
            <span class="terminal-launch-logo-text">BLMTRM</span>
          </div>
          <p class="terminal-launch-tagline">Bloomberg-style terminal · charts · screener · AI · economics</p>
        </div>

        <div class="terminal-launch-views">${viewRows}</div>

        <div class="terminal-launch-footer">
          <div class="terminal-launch-symbols">
            <span class="terminal-launch-sym-label">OPEN WITH</span>
            ${symbolPills}
          </div>
          <a
            class="terminal-launch-btn"
            href="${getTerminalUrl(defaultSymbol)}"
            target="_blank"
            rel="noopener"
            id="terminalLaunchBtn"
          >
            LAUNCH TERMINAL ↗
          </a>
        </div>
      </div>
    `;

    this.content.querySelectorAll<HTMLButtonElement>('.terminal-sym-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.symbol;
        if (sym) window.open(getTerminalUrl(sym), '_blank', 'noopener');
      });
    });
  }

  async refresh(): Promise<void> {
    this.render();
  }
}
