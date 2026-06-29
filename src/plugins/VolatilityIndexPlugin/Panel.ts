import { Panel } from '@/components/Panel';
import { fetchVixSnapshot, type VixSnapshot } from './vix-data';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface VixGaugeSettings {
  elevatedThreshold: number;
  highFearThreshold: number;
}

const DEFAULT_VIX_SETTINGS: VixGaugeSettings = {
  elevatedThreshold: 20,
  highFearThreshold: 30,
};

function vixColor(price: number, elevated: number, highFear: number): string {
  if (price < elevated) return 'var(--positive, #22c55e)';
  if (price < highFear) return 'var(--warning, #eab308)';
  return 'var(--negative, #ef4444)';
}

function vixLabel(price: number, elevated: number, highFear: number): string {
  if (price < elevated) return 'Low';
  if (price < highFear) return 'Normal';
  if (price < highFear + 5) return 'Elevated';
  return 'High Fear';
}

function vixTermStructure(price: number, elevated: number): { state: string; color: string } {
  if (price > elevated + 5) return { state: 'Contango (normal)', color: 'var(--positive)' };
  if (price > elevated) return { state: 'Contango (normal)', color: 'var(--text-muted)' };
  return { state: 'Backwardation (signal)', color: 'var(--warning)' };
}

export class VixGaugePanel extends Panel {
  private settings: VixGaugeSettings;
  private lastSnapshot: VixSnapshot | null = null;

  constructor() {
    super({ id: 'vix-gauge', title: 'VIX', showCount: false, className: '' });
    this.settings = this.loadSettings();
    this.refresh();
  }

  private loadSettings(): VixGaugeSettings {
    try {
      const raw = localStorage.getItem('mdm-vix-gauge-settings');
      if (raw) return { ...DEFAULT_VIX_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_VIX_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem('mdm-vix-gauge-settings', JSON.stringify(this.settings));
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const snapshot = await fetchVixSnapshot();
      this.lastSnapshot = snapshot;
      this.renderGauge(snapshot);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load VIX data', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(): void {
    if (this.lastSnapshot) this.renderGauge(this.lastSnapshot);
  }

  private renderGauge(snapshot: VixSnapshot): void {
    const { elevatedThreshold, highFearThreshold } = this.settings;
    const color = vixColor(snapshot.price, elevatedThreshold, highFearThreshold);
    const arrow = snapshot.change >= 0 ? '↑' : '↓';
    const changeColor = snapshot.change >= 0 ? 'var(--negative)' : 'var(--positive)';
    const range52 = snapshot.high52w - snapshot.low52w;
    const percentile = range52 > 0 ? ((snapshot.price - snapshot.low52w) / range52) * 100 : 50;
    const barPct = Math.max(0, Math.min(100, (snapshot.price / 80) * 100));

    this.setContent(`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;width:100%;box-sizing:border-box;position:relative;"
           title="52w range: ${snapshot.low52w.toFixed(1)} — ${snapshot.high52w.toFixed(1)} | Percentile: ${percentile.toFixed(0)}%">
        <div>
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">VIX</div>
          <div style="font-size:28px;font-weight:700;color:${color};">${snapshot.price.toFixed(2)}</div>
        </div>
        <div style="flex:1;margin:0 16px;">
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${barPct.toFixed(1)}%;background:${color};border-radius:2px;transition:width 0.3s;"></div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:600;color:${changeColor};">${arrow} ${snapshot.change.toFixed(2)} (${snapshot.changePercent.toFixed(1)}%)</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${vixLabel(snapshot.price, elevatedThreshold, highFearThreshold)}</div>
        </div>
      </div>
    `);
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<VixGaugeSettings>[] = [
      {
        key: 'elevatedThreshold',
        label: 'Elevated threshold',
        type: 'number',
        min: 10,
        max: 50,
        step: 1,
      },
      {
        key: 'highFearThreshold',
        label: 'High fear threshold',
        type: 'number',
        min: 15,
        max: 80,
        step: 1,
      },
    ];

    return createSettingsForm<VixGaugeSettings>({
      title: 'VIX Gauge Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
        this.render();
      },
    });
  }

  public setMode(_mode: 'monitoring' | 'research'): void {}
}

interface VolIndexSettings {
  showTermStructure: boolean;
  showPercentile: boolean;
}

const DEFAULT_VOL_SETTINGS: VolIndexSettings = {
  showTermStructure: true,
  showPercentile: true,
};

export class VolatilityIndexPanel extends Panel {
  private volSettings: VolIndexSettings;
  private lastSnapshot: VixSnapshot | null = null;

  constructor() {
    super({
      id: 'volatility-index',
      title: 'Volatility Index',
      showCount: true,
      className: 'panel-wide',
    });
    this.volSettings = this.loadVolSettings();
    this.refresh();
  }

  private loadVolSettings(): VolIndexSettings {
    try {
      const raw = localStorage.getItem('mdm-vol-index-settings');
      if (raw) return { ...DEFAULT_VOL_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_VOL_SETTINGS };
  }

  private saveVolSettings(): void {
    localStorage.setItem('mdm-vol-index-settings', JSON.stringify(this.volSettings));
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const snapshot = await fetchVixSnapshot();
      this.lastSnapshot = snapshot;
      this.renderContent(snapshot);
      this.setCount(1);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load VIX data', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(): void {
    if (this.lastSnapshot) this.renderContent(this.lastSnapshot);
  }

  private renderContent(snapshot: VixSnapshot): void {
    const { elevatedThreshold, highFearThreshold } = DEFAULT_VIX_SETTINGS;
    const color = vixColor(snapshot.price, elevatedThreshold, highFearThreshold);
    const arrow = snapshot.change >= 0 ? '↑' : '↓';
    const changeColor = snapshot.change >= 0 ? 'var(--negative)' : 'var(--positive)';
    const label = vixLabel(snapshot.price, elevatedThreshold, highFearThreshold);
    const ts = vixTermStructure(snapshot.price, elevatedThreshold);
    const range = snapshot.high52w - snapshot.low52w;
    const percentile = range > 0 ? ((snapshot.price - snapshot.low52w) / range) * 100 : 50;
    const mode = this.getMode();

    this.setContent(`
      <div class="vix-panel" style="padding:16px;">
        <div class="vix-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:32px;font-weight:700;color:${color};">${snapshot.price.toFixed(2)}</div>
            <div style="font-size:13px;color:${color};font-weight:500;margin-top:2px;">${label}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:600;color:${changeColor};">${arrow} ${snapshot.change.toFixed(2)}</div>
            <div style="font-size:13px;color:${changeColor};">${snapshot.changePercent.toFixed(1)}%</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">1 Day Change</div>
          </div>
        </div>
        ${
          this.volSettings.showPercentile
            ? `
        <div class="vix-range-bar" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px;">
            <span>52w Low: ${snapshot.low52w.toFixed(2)}</span>
            <span>52w High: ${snapshot.high52w.toFixed(2)}</span>
          </div>
          <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;position:relative;">
            <div style="height:100%;width:${Math.min(100, Math.max(0, percentile))}%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
          </div>
        </div>
        `
            : ''
        }
        <div class="vix-details" style="${mode === 'monitoring' ? 'display:none;' : ''}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg);border-radius:4px;font-size:12px;">
              <span style="color:var(--text-muted);">Previous Close</span>
              <span style="font-weight:600;">${snapshot.previousClose.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg);border-radius:4px;font-size:12px;">
              <span style="color:var(--text-muted);">52w Range</span>
              <span style="font-weight:600;">${snapshot.low52w.toFixed(2)} — ${snapshot.high52w.toFixed(2)}</span>
            </div>
          </div>
          ${
            this.volSettings.showTermStructure
              ? `
          <div style="display:flex;justify-content:space-between;padding:8px;margin-top:8px;background:var(--bg);border-radius:4px;font-size:12px;">
            <span style="color:var(--text-muted);">Term Structure</span>
            <span style="font-weight:600;color:${ts.color};">${ts.state}</span>
          </div>
          `
              : ''
          }
        </div>
      </div>
    `);
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<VolIndexSettings>[] = [
      { key: 'showTermStructure', label: 'Show term structure', type: 'checkbox' },
      { key: 'showPercentile', label: 'Show percentile ranking', type: 'checkbox' },
    ];

    return createSettingsForm<VolIndexSettings>({
      title: 'Volatility Index Settings',
      schema,
      initialValues: { ...this.volSettings },
      onChange: vals => {
        this.volSettings = vals;
        this.saveVolSettings();
        this.render();
      },
    });
  }

  protected onModeChange(mode: 'monitoring' | 'research'): void {
    const details = this.content.querySelector('.vix-details') as HTMLElement | null;
    if (details) {
      details.style.display = mode === 'monitoring' ? 'none' : '';
    }
  }
}
