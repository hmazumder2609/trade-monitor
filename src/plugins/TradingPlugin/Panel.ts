import { Panel } from '@/components/Panel';
import { getWatchlistSymbols } from '@/services/data-layer';

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

interface TradingSettings {
  showPositions: boolean;
  defaultSymbol: string;
}

const SETTINGS_KEY = 'mdm-trading-settings';
const DEFAULT_SETTINGS: TradingSettings = { showPositions: true, defaultSymbol: 'AAPL' };

export class TradingPanel extends Panel {
  private settings: TradingSettings;

  constructor() {
    super({ id: 'trading', title: 'Trading Terminal', className: 'panel-wide' });
    this.settings = this.loadSettings();
    this.render();
  }

  private loadSettings(): TradingSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Trading Terminal Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" id="tpShowPositions" ${this.settings.showPositions ? 'checked' : ''} />
        Show positions
      </label>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Default symbol:
        <select class="social-settings-select" id="tpDefaultSymbol">
          ${getWatchlistSymbols()
            .slice(0, 10)
            .map(
              s =>
                `<option value="${s}" ${this.settings.defaultSymbol === s ? 'selected' : ''}>${s}</option>`
            )
            .join('')}
          <option value="AAPL" ${this.settings.defaultSymbol === 'AAPL' && !getWatchlistSymbols().includes(this.settings.defaultSymbol) ? 'selected' : ''}>AAPL</option>
        </select>
      </label>
    `;

    el.querySelector('#tpShowPositions')!.addEventListener('change', e => {
      this.settings.showPositions = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.render();
    });

    el.querySelector('#tpDefaultSymbol')!.addEventListener('change', e => {
      this.settings.defaultSymbol = (e.target as HTMLSelectElement).value;
      this.saveSettings();
      this.render();
    });

    return el;
  }

  private render(): void {
    const symbols = getWatchlistSymbols().slice(0, 8);
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
