import { Panel } from './Panel';
import {
  fetchMacroHistory,
  fetchMacroIndicators,
  type MacroObservation,
  type MacroIndicator,
} from '@/services/macro';
import { miniSparkline } from '@/utils';

interface IndicatorData {
  indicator: MacroIndicator;
  history: MacroObservation[];
}

const TRACKED = ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE'];

export class EconomicIndicatorsPanel extends Panel {
  private listEl: HTMLElement | null = null;

  constructor() {
    super({ id: 'economic-indicators', title: 'Economic Indicators', showCount: true });
    this.buildLayout();
    this.refresh();
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
      const [indicators, gdp, cpi, unrate, fedfunds, pce] = await Promise.all([
        fetchMacroIndicators(TRACKED),
        fetchMacroHistory('GDP', 24),
        fetchMacroHistory('CPIAUCSL', 24),
        fetchMacroHistory('UNRATE', 24),
        fetchMacroHistory('FEDFUNDS', 24),
        fetchMacroHistory('PCE', 24),
      ]);

      const map: Record<string, MacroObservation[]> = {
        GDP: gdp.observations,
        CPIAUCSL: cpi.observations,
        UNRATE: unrate.observations,
        FEDFUNDS: fedfunds.observations,
        PCE: pce.observations,
      };

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
}
