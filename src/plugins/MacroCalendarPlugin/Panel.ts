import { Panel } from '@/components/Panel';
import { fetchMacroIndicators, type MacroIndicator } from '@/services/macro';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';
import { formatTimestamp } from '@/utils/data-display';

const STORAGE_KEY = 'mdm-macro-calendar-indicators';

const INDICATOR_IMPACT: Record<string, string> = {
  GDP: 'high',
  CPIAUCSL: 'high',
  UNRATE: 'high',
  FEDFUNDS: 'high',
  PCE: 'medium',
  PAYEMS: 'high',
  NFPA: 'high',
};

const ALL_INDICATORS = ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE', 'PAYEMS', 'NFPA'];

const DEFAULT_INDICATORS = ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE', 'PAYEMS'];

function loadTrackedIndicators(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [...DEFAULT_INDICATORS];
}

function saveTrackedIndicators(indicators: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(indicators));
}

type MacroCalendarSettings = Record<(typeof ALL_INDICATORS)[number], boolean>;

function arrayToSettings(arr: string[]): MacroCalendarSettings {
  const obj: any = {};
  for (const ind of ALL_INDICATORS) obj[ind] = arr.includes(ind);
  return obj;
}

function settingsToArray(settings: MacroCalendarSettings): string[] {
  return ALL_INDICATORS.filter(ind => settings[ind]);
}

export class MacroCalendarPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private footerEl: HTMLElement | null = null;
  private trackedIndicators: string[];
  private lastUpdated: Date | null = null;

  constructor() {
    super({ id: 'macro-calendar', title: 'Macro Calendar' });
    this.trackedIndicators = loadTrackedIndicators();
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.listEl = document.createElement('div');
    this.listEl.className = 'macro-calendar-list';
    this.content.appendChild(this.listEl);
    this.footerEl = document.createElement('div');
    this.footerEl.className = 'data-meta';
    this.footerEl.style.cssText =
      'padding:4px 8px;border-top:1px solid var(--border-color,#333);font-size:11px;opacity:0.7;';
    this.footerEl.textContent = '';
    this.content.appendChild(this.footerEl);
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<MacroCalendarSettings>[] = ALL_INDICATORS.map(ind => ({
      key: ind,
      label: ind,
      type: 'checkbox',
    }));

    return createSettingsForm<MacroCalendarSettings>({
      title: 'Tracked Indicators',
      schema,
      initialValues: arrayToSettings(this.trackedIndicators),
      onChange: vals => {
        this.trackedIndicators = settingsToArray(vals);
        saveTrackedIndicators(this.trackedIndicators);
        this.refresh();
      },
    });
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      this.setDataWindow('Last 12mo');
      const indicators = await fetchMacroIndicators(this.trackedIndicators);
      this.lastUpdated = new Date();
      this.render(indicators);
    } catch {
      this.showError('Failed to load macro calendar', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(indicators: MacroIndicator[]): void {
    if (!this.listEl) return;
    const sorted = [...indicators].sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1));
    this.listEl.innerHTML = sorted
      .map(ind => {
        const impact = INDICATOR_IMPACT[ind.series] || 'low';
        const change = ind.value != null ? this.formatValue(ind.series, ind.value) : '\u2014';
        const seriesUrl = `https://fred.stlouisfed.org/series/${ind.series}`;
        return `
        <div class="macro-event-row macro-impact-${impact}">
          <span class="macro-event-impact ${impact}">${impact.toUpperCase()}</span>
          <span class="macro-event-name">
            <span class="data-source-badge data-source-api">FRED</span>
            <a href="${seriesUrl}" target="_blank" rel="noopener" class="macro-event-link">${ind.name}</a>
          </span>
          <span class="macro-event-date">${ind.date || ''}</span>
          <span class="macro-event-value">${change}</span>
        </div>`;
      })
      .join('');
    if (this.footerEl) {
      this.footerEl.textContent = this.lastUpdated
        ? `Updated ${formatTimestamp(this.lastUpdated)}`
        : '';
    }
  }

  private formatValue(series: string, value: number): string {
    if (series === 'FEDFUNDS') return value.toFixed(2) + '%';
    if (series === 'UNRATE') return value.toFixed(1) + '%';
    if (series === 'CPIAUCSL' || series === 'PCE') return value.toFixed(1);
    if (series === 'GDP') return value.toFixed(1) + '%';
    return value.toLocaleString();
  }
}
