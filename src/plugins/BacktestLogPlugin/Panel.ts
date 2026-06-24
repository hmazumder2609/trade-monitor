import { Panel } from '@/components/Panel';
import {
  getBacktests,
  saveBacktest,
  deleteBacktest,
  type BacktestLog,
} from '@/services/strategy-store';
import { miniSparkline } from '@/utils';

interface BacktestLogSettings {
  sortBy: 'date' | 'return' | 'duration';
}

const SETTINGS_KEY = 'mdm-backtest-log-settings';
const DEFAULT_SETTINGS: BacktestLogSettings = { sortBy: 'date' };

export class BacktestLogPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private settings: BacktestLogSettings;

  constructor() {
    super({ id: 'backtest-log', title: 'Backtest Log', showCount: true });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): BacktestLogSettings {
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
      <div class="social-settings-header">Backtest Log Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Sort by:
        <select class="social-settings-select" id="blSortBy">
          <option value="date" ${this.settings.sortBy === 'date' ? 'selected' : ''}>Date</option>
          <option value="return" ${this.settings.sortBy === 'return' ? 'selected' : ''}>Return</option>
          <option value="duration" ${this.settings.sortBy === 'duration' ? 'selected' : ''}>Duration</option>
        </select>
      </label>
    `;

    el.querySelector('#blSortBy')!.addEventListener('change', e => {
      this.settings.sortBy = (e.target as HTMLSelectElement).value as BacktestLogSettings['sortBy'];
      this.saveSettings();
      this.refresh();
    });

    return el;
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ New Backtest';
    addBtn.addEventListener('click', () => this.showEditor());
    this.content.appendChild(addBtn);

    this.listEl = document.createElement('div');
    this.listEl.className = 'backtest-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const backtests = getBacktests();
      this.render(backtests);
      this.setCount(backtests.length);
    } catch {
      this.showError('Failed to load backtests', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(backtests: BacktestLog[]): void {
    if (!this.listEl) return;
    if (backtests.length === 0) {
      this.listEl.innerHTML =
        '<div class="strategy-empty">No backtests logged yet. Click "+ New Backtest" to record results.</div>';
      return;
    }

    this.listEl.innerHTML = backtests
      .map(b => {
        const equitySpark = b.equityCurve.length > 0 ? miniSparkline(b.equityCurve, 0) : '';
        return `
        <div class="backtest-card">
          <div class="backtest-header">
            <span class="backtest-name">${this.escape(b.strategyName)}</span>
            <span class="backtest-return ${b.totalReturn >= 0 ? 'positive' : 'negative'}">${b.totalReturn >= 0 ? '+' : ''}${(b.totalReturn * 100).toFixed(1)}%</span>
          </div>
          <div class="backtest-metrics">
            <div class="backtest-metric">
              <span class="metric-label">Win Rate</span>
              <span class="metric-value">${(b.winRate * 100).toFixed(0)}%</span>
            </div>
            <div class="backtest-metric">
              <span class="metric-label">Sharpe</span>
              <span class="metric-value">${b.sharpeRatio.toFixed(2)}</span>
            </div>
            <div class="backtest-metric">
              <span class="metric-label">Max DD</span>
              <span class="metric-value negative">${(b.maxDrawdown * 100).toFixed(1)}%</span>
            </div>
            <div class="backtest-metric">
              <span class="metric-label">Trades</span>
              <span class="metric-value">${b.tradesCount}</span>
            </div>
          </div>
          ${equitySpark ? `<div class="backtest-equity">${equitySpark}</div>` : ''}
          <div class="backtest-dates">
            ${b.startDate} → ${b.endDate}
          </div>
          <div class="backtest-actions">
            <button class="strategy-del-btn" data-id="${b.id}">Delete</button>
          </div>
        </div>`;
      })
      .join('');

    this.listEl.querySelectorAll('.strategy-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this backtest?')) {
          deleteBacktest(id);
          this.refresh();
        }
      })
    );
  }

  private showEditor(): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal backtest-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">Log Backtest Result</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <input class="settings-input" id="btName" placeholder="Strategy name" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="btStart" type="date" placeholder="Start date" />
          <input class="settings-input" id="btEnd" type="date" placeholder="End date" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="btReturn" type="number" step="0.01" placeholder="Total return (e.g. 0.25)" />
          <input class="settings-input" id="btWinRate" type="number" step="0.01" placeholder="Win rate (e.g. 0.55)" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="btSharpe" type="number" step="0.01" placeholder="Sharpe ratio" />
          <input class="settings-input" id="btMaxDD" type="number" step="0.01" placeholder="Max drawdown (e.g. 0.15)" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="btTrades" type="number" step="1" placeholder="Trade count" />
        </div>
        <textarea class="settings-input strategy-textarea" id="btNotes" placeholder="Notes / parameter details"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="btCancel">Cancel</button>
          <button class="settings-save-btn" id="btSave">Save Backtest</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#btCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#btSave')!.addEventListener('click', () => {
      const strategyName = (modal.querySelector('#btName') as HTMLInputElement).value.trim();
      if (!strategyName) return;
      const totalReturn =
        parseFloat((modal.querySelector('#btReturn') as HTMLInputElement).value) || 0;
      const winRate =
        parseFloat((modal.querySelector('#btWinRate') as HTMLInputElement).value) || 0;
      const sharpeRatio =
        parseFloat((modal.querySelector('#btSharpe') as HTMLInputElement).value) || 0;
      const maxDrawdown =
        parseFloat((modal.querySelector('#btMaxDD') as HTMLInputElement).value) || 0;
      const tradesCount =
        parseInt((modal.querySelector('#btTrades') as HTMLInputElement).value, 10) || 0;
      const startDate = (modal.querySelector('#btStart') as HTMLInputElement).value;
      const endDate = (modal.querySelector('#btEnd') as HTMLInputElement).value;
      const notes = (modal.querySelector('#btNotes') as HTMLTextAreaElement).value.trim();

      saveBacktest({
        strategyName,
        parameters: {},
        startDate,
        endDate,
        totalReturn,
        maxDrawdown,
        sharpeRatio,
        winRate,
        tradesCount,
        equityCurve: [],
        notes,
      });
      overlay.remove();
      this.refresh();
    });
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
