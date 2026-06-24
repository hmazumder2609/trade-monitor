import { Panel } from '@/components/Panel';
import {
  fetchOptionsSummary,
  fetchUnusualActivity,
  fetchBlockTrades,
  type OptionsSummary,
  type UnusualOption,
  type BlockTrade,
} from '@/services/options-flow';
import { escapeHtml } from '@/utils';

type OptionsTab = 'summary' | 'unusual' | 'flow';

interface OptionsFlowSettings {
  showUnusualVolume: boolean;
  minPremium: 0 | 5 | 10 | 20;
}

const SETTINGS_KEY = 'mdm-options-flow-settings';
const DEFAULT_SETTINGS: OptionsFlowSettings = { showUnusualVolume: true, minPremium: 0 };

export class OptionsFlowPanel extends Panel {
  private summary: OptionsSummary | null = null;
  private unusual: UnusualOption[] = [];
  private trades: BlockTrade[] = [];
  private activeTab: OptionsTab = 'summary';
  private tabsEl: HTMLElement | null = null;
  private containerEl: HTMLElement | null = null;
  private refreshGen = 0;
  private settings: OptionsFlowSettings;

  constructor() {
    super({
      id: 'options-flow',
      title: 'Unusual Options Activity',
      showCount: true,
      className: 'panel-wide',
    });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): OptionsFlowSettings {
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
      <div class="social-settings-header">Options Flow Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" id="ofShowUnusualVolume" ${this.settings.showUnusualVolume ? 'checked' : ''} />
        Show unusual volume
      </label>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Min premium ($k):
        <select class="social-settings-select" id="ofMinPremium">
          <option value="0" ${this.settings.minPremium === 0 ? 'selected' : ''}>Any</option>
          <option value="5" ${this.settings.minPremium === 5 ? 'selected' : ''}>$5k</option>
          <option value="10" ${this.settings.minPremium === 10 ? 'selected' : ''}>$10k</option>
          <option value="20" ${this.settings.minPremium === 20 ? 'selected' : ''}>$20k</option>
        </select>
      </label>
    `;

    el.querySelector('#ofShowUnusualVolume')!.addEventListener('change', e => {
      this.settings.showUnusualVolume = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.renderActiveTab();
    });

    el.querySelector('#ofMinPremium')!.addEventListener('change', e => {
      this.settings.minPremium = parseInt(
        (e.target as HTMLSelectElement).value,
        10
      ) as OptionsFlowSettings['minPremium'];
      this.saveSettings();
      this.renderActiveTab();
    });

    return el;
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'panel-tabs';
    this.renderTabs();
    this.content.appendChild(this.tabsEl);

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'options-flow-content';
    this.containerEl.style.padding = '4px';
    this.content.appendChild(this.containerEl);
  }

  private renderTabs(): void {
    if (!this.tabsEl) return;
    this.tabsEl.innerHTML = '';
    const tabLabels: Record<OptionsTab, string> = {
      summary: 'Summary',
      unusual: 'Unusual',
      flow: 'Flow',
    };
    for (const tab of ['summary', 'unusual', 'flow'] as OptionsTab[]) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${tab === this.activeTab ? 'active' : ''}`;
      btn.textContent = tabLabels[tab];
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.renderTabs();
        this.renderActiveTab();
      });
      this.tabsEl.appendChild(btn);
    }
  }

  async refresh(): Promise<void> {
    const gen = ++this.refreshGen;
    this.setFetching(true);
    try {
      const [summary, unusual, trades] = await Promise.all([
        fetchOptionsSummary(),
        fetchUnusualActivity(),
        fetchBlockTrades(),
      ]);
      if (gen !== this.refreshGen) return;
      this.summary = summary;
      this.unusual = unusual;
      this.trades = trades;
      this.setCount(unusual.length);
      this.setDataBadge('live');
      this.renderActiveTab();
    } catch {
      if (gen !== this.refreshGen) return;
      this.showError('Failed to load options data', () => this.refresh());
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private renderActiveTab(): void {
    if (!this.containerEl) return;
    switch (this.activeTab) {
      case 'summary':
        this.renderSummary();
        break;
      case 'unusual':
        this.renderUnusual();
        break;
      case 'flow':
        this.renderFlow();
        break;
    }
  }

  private renderSummary(): void {
    if (!this.containerEl || !this.summary) return;
    const s = this.summary;
    const ratioColor =
      s.putCallRatio > 1 ? 'var(--red)' : s.putCallRatio < 0.7 ? 'var(--green)' : 'var(--text)';
    this.containerEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px">
        <div style="background:var(--surface);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">P/C Ratio</div>
          <div style="font-size:20px;font-weight:700;color:${ratioColor}">${s.putCallRatio.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${s.date || ''}</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Total Volume</div>
          <div style="font-size:20px;font-weight:700">${s.totalVolume.toLocaleString()}</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Call Volume</div>
          <div style="font-size:20px;font-weight:700;color:var(--green)">${s.callVolume.toLocaleString()}</div>
        </div>
        <div style="background:var(--surface);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Put Volume</div>
          <div style="font-size:20px;font-weight:700;color:var(--red)">${s.putVolume.toLocaleString()}</div>
        </div>
      </div>`;
  }

  private renderUnusual(): void {
    if (!this.containerEl) return;
    if (this.unusual.length === 0) {
      this.containerEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No unusual activity</div>`;
      return;
    }
    const rows = this.unusual
      .map(u => {
        const typeClass = u.optionType === 'call' ? 'positive' : 'negative';
        const sentClass =
          u.sentiment === 'bullish' ? 'positive' : u.sentiment === 'bearish' ? 'negative' : '';
        const sentLabel =
          u.sentiment === 'bullish'
            ? '\u2191 Bullish'
            : u.sentiment === 'bearish'
              ? '\u2193 Bearish'
              : '\u2014';
        return `
        <div class="stock-row" style="display:grid;grid-template-columns:70px 28px 70px 70px 60px 60px 60px 70px;align-items:center;padding:6px 8px;gap:4px;font-size:12px">
          <span style="font-weight:600">${escapeHtml(u.symbol)}</span>
          <span class="${typeClass}" style="font-weight:700;font-size:11px">${u.optionType === 'call' ? 'C' : 'P'}</span>
          <span class="num">$${u.strike.toFixed(2)}</span>
          <span style="color:var(--text-muted);font-size:11px">${u.expiration}</span>
          <span class="num">${u.volume.toLocaleString()}</span>
          <span class="num">${u.openInterest.toLocaleString()}</span>
          <span class="num">${u.vOiRatio.toFixed(1)}</span>
          <span class="${sentClass}" style="font-size:11px">${sentLabel}</span>
        </div>`;
      })
      .join('');
    this.containerEl.innerHTML = `
      <div style="display:grid;grid-template-columns:70px 28px 70px 70px 60px 60px 60px 70px;padding:6px 8px 4px;gap:4px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">
        <span>Symbol</span><span></span><span>Strike</span><span>Expiry</span><span>Volume</span><span>OI</span><span>V/OI</span><span>Sentiment</span>
      </div>
      ${rows}`;
  }

  private renderFlow(): void {
    if (!this.containerEl) return;
    const sorted = [...this.trades].sort((a, b) => b.premium - a.premium);
    if (sorted.length === 0) {
      this.containerEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No block trades</div>`;
      return;
    }
    this.containerEl.innerHTML = sorted
      .map(t => {
        const typeClass = t.optionType === 'call' ? 'positive' : 'negative';
        const sentIcon =
          t.sentiment === 'bullish' ? '\u2191' : t.sentiment === 'bearish' ? '\u2193' : '\u2014';
        const sentClass =
          t.sentiment === 'bullish' ? 'positive' : t.sentiment === 'bearish' ? 'negative' : '';
        return `
        <div class="stock-row" style="display:grid;grid-template-columns:1fr auto;align-items:center;padding:8px;gap:4px;font-size:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600">${escapeHtml(t.symbol)}</span>
            <span class="${typeClass}" style="font-weight:700;font-size:11px">${t.optionType === 'call' ? 'C' : 'P'}</span>
            <span class="num">$${t.strike.toFixed(2)}</span>
            <span style="color:var(--text-muted)">${t.expiration}</span>
            <span class="${sentClass}">${sentIcon}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-weight:600">$${t.premium.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span style="color:var(--text-muted);font-size:11px">${t.size.toLocaleString()} contracts</span>
          </div>
        </div>`;
      })
      .join('');
  }
}
