import { Panel } from '@/components/Panel';
import {
  fetchMacroHistory,
  fetchMacroIndicators,
  type MacroObservation,
  type MacroIndicator,
} from '@/services/macro';
import { miniSparkline } from '@/utils';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

const TRACKED = ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE'];
const ALL_INDICATORS = ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE', 'PAYEMS', 'NFPA'];
const TRACKED_KEY = 'mdm-economic-indicators-tracked';

type EconomicIndicatorsSettings = Record<(typeof ALL_INDICATORS)[number], boolean>;

function eiArrayToSettings(arr: string[]): EconomicIndicatorsSettings {
  const obj: any = {};
  for (const ind of ALL_INDICATORS) obj[ind] = arr.includes(ind);
  return obj;
}

function eiSettingsToArray(settings: EconomicIndicatorsSettings): string[] {
  return ALL_INDICATORS.filter(ind => settings[ind]);
}

export class EconomicIndicatorsPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private trackedIndicators: string[];

  constructor() {
    super({ id: 'economic-indicators', title: 'Economic Indicators', showCount: true });
    this.trackedIndicators = this.loadTrackedIndicators();
    this.buildLayout();
    this.refresh();
  }

  private loadTrackedIndicators(): string[] {
    try {
      const raw = localStorage.getItem(TRACKED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [...TRACKED];
  }

  private saveTrackedIndicators(): void {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(this.trackedIndicators));
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';
    this.listEl = document.createElement('div');
    this.listEl.className = 'macro-indicators-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const historyPromises = this.trackedIndicators.map(s => fetchMacroHistory(s, 24));
      const [indicators, ...histories] = await Promise.all([
        fetchMacroIndicators(this.trackedIndicators),
        ...historyPromises,
      ]);

      const map: Record<string, MacroObservation[]> = {};
      this.trackedIndicators.forEach((s, i) => {
        map[s] = histories[i].observations;
      });

      this.render(indicators, map);
      this.setCount(indicators.length);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load indicators', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(
    indicators: MacroIndicator[],
    historyMap: Record<string, MacroObservation[]>
  ): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = indicators
      .map(ind => {
        const hist = historyMap[ind.series] || [];
        const vals = hist
          .map(o => o.value)
          .filter(v => !isNaN(v))
          .reverse();
        const yoy =
          hist.length >= 12 ? ((hist[0].value - hist[11].value) / hist[11].value) * 100 : null;
        const spark = vals.length > 0 ? miniSparkline(vals.slice(-20), 0) : '';
        return `
        <div class="macro-indicator-row">
          <div class="macro-indicator-header">
            <span class="macro-indicator-name">${ind.name}</span>
            <span class="macro-indicator-value">${ind.value != null ? this.formatValue(ind.series, ind.value) : '\u2014'}</span>
          </div>
          <div class="macro-indicator-meta">
            <span class="macro-indicator-date">${ind.date || ''}</span>
            ${yoy != null ? `<span class="macro-indicator-yoy ${yoy >= 0 ? 'positive' : 'negative'}">YoY: ${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%</span>` : ''}
          </div>
          <div class="macro-indicator-spark">${spark}</div>
        </div>`;
      })
      .join('');
  }

  private formatValue(series: string, value: number): string {
    if (series === 'FEDFUNDS' || series === 'UNRATE') return value.toFixed(2) + '%';
    if (series === 'CPIAUCSL' || series === 'PCE') return value.toFixed(1);
    if (series === 'GDP') return value.toFixed(1) + '%';
    return value.toLocaleString();
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<EconomicIndicatorsSettings>[] = ALL_INDICATORS.map(s => ({
      key: s,
      label: s,
      type: 'checkbox',
    }));

    return createSettingsForm<EconomicIndicatorsSettings>({
      title: 'Tracked Indicators',
      schema,
      initialValues: eiArrayToSettings(this.trackedIndicators),
      onChange: vals => {
        this.trackedIndicators = eiSettingsToArray(vals);
        this.saveTrackedIndicators();
        this.refresh();
      },
    });
  }
}
