import { Panel } from '@/components/Panel';
import { fetchYieldCurve, type YieldCurveData } from '@/services/macro';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';
import { formatTimestamp } from '@/utils/data-display';

const TERM_LABELS: Record<string, string> = {
  '3m': '3M',
  '2y': '2Y',
  '5y': '5Y',
  '10y': '10Y',
  '30y': '30Y',
};

const TERM_ORDER = ['3m', '2y', '5y', '10y', '30y'];

interface YieldCurveSettings {
  timeRange: string;
  showInversionAlerts: boolean;
}

const DEFAULT_YC_SETTINGS: YieldCurveSettings = { timeRange: '1y', showInversionAlerts: true };

export class YieldCurvePanel extends Panel {
  private contentEl: HTMLElement | null = null;
  private settings: YieldCurveSettings;
  private lastUpdated: Date | null = null;

  constructor() {
    super({ id: 'yield-curve', title: 'Yield Curve' });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): YieldCurveSettings {
    try {
      const raw = localStorage.getItem('mdm-yield-curve-settings');
      if (raw) return { ...DEFAULT_YC_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_YC_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem('mdm-yield-curve-settings', JSON.stringify(this.settings));
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.contentEl = this.content;
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      this.setDataWindow('Latest');
      const data = await fetchYieldCurve();
      this.lastUpdated = new Date();
      this.render(data);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load yield curve', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(data: YieldCurveData): void {
    if (!this.contentEl) return;

    const yields = data.yields;
    const spreads = data.spreads;
    const points = TERM_ORDER.map(t => yields.find(y => y.term === t)).filter(Boolean);
    const maxYield = Math.max(...points.map(p => p!.value ?? 0), 0.1);
    const minYield = Math.min(...points.map(p => p!.value ?? 0), 0);

    const isInverted2s10s = spreads['2s10s'] != null && spreads['2s10s'] < 0;
    const isInverted3m10s = spreads['3m10s'] != null && spreads['3m10s'] < 0;
    const regime = isInverted2s10s ? 'inverted' : 'normal';

    const bars = points
      .map(p => {
        const v = p!.value ?? 0;
        const h = maxYield > 0 ? ((v - minYield) / (maxYield - minYield)) * 120 + 20 : 20;
        return `<div class="yc-bar-wrap">
          <div class="yc-bar" style="height:${h}px" title="${p!.term}: ${v.toFixed(2)}%"></div>
          <div class="yc-bar-label">${TERM_LABELS[p!.term] || p!.term}</div>
          <div class="yc-bar-value">${v.toFixed(2)}%</div>
        </div>`;
      })
      .join('');

    this.contentEl.innerHTML = `
      <div class="yc-regime yc-${regime}">
        Curve: ${regime === 'inverted' ? '\u26A0 Inverted' : '\u2705 Normal'}
      </div>
      <div class="yc-chart" id="ycChart">${bars}</div>
      <div class="yc-spreads">
        <div class="yc-spread ${spreads['2s10s'] != null && spreads['2s10s'] < 0 ? 'negative' : 'positive'}">
          <span class="yc-spread-label">2s10s</span>
          <span class="yc-spread-value">${spreads['2s10s'] != null ? (spreads['2s10s'] * 100).toFixed(1) + 'bp' : '\u2014'}</span>
        </div>
        <div class="yc-spread ${spreads['3m10s'] != null && spreads['3m10s'] < 0 ? 'negative' : 'positive'}">
          <span class="yc-spread-label">3m10s</span>
          <span class="yc-spread-value">${spreads['3m10s'] != null ? (spreads['3m10s'] * 100).toFixed(1) + 'bp' : '\u2014'}</span>
        </div>
      </div>
      <div class="data-meta" style="padding:4px 8px;border-top:1px solid var(--border-color,#333);font-size:11px;opacity:0.7">
        <span class="data-source-badge data-source-api">UST</span>
        Updated ${this.lastUpdated ? formatTimestamp(this.lastUpdated) : ''}
      </div>`;
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<YieldCurveSettings>[] = [
      {
        key: 'timeRange',
        label: 'Time Range',
        type: 'select',
        options: [
          { value: '1m', label: '1 Month' },
          { value: '3m', label: '3 Months' },
          { value: '6m', label: '6 Months' },
          { value: '1y', label: '1 Year' },
        ],
      },
      { key: 'showInversionAlerts', label: 'Show Inversion Alerts', type: 'checkbox' },
    ];

    return createSettingsForm<YieldCurveSettings>({
      title: 'Yield Curve Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
        this.refresh();
      },
    });
  }
}
