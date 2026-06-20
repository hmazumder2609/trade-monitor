import { Panel } from '@/components/Panel';
import { fetchMacroIndicators, type MacroIndicator } from '@/services/macro';

const INDICATOR_IMPACT: Record<string, string> = {
  GDP: 'high',
  CPIAUCSL: 'high',
  UNRATE: 'high',
  FEDFUNDS: 'high',
  PCE: 'medium',
  PAYEMS: 'high',
  NFPA: 'high',
};

const INDICATOR_WATCHLIST = ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE', 'PAYEMS'];

export class MacroCalendarPanel extends Panel {
  private listEl: HTMLElement | null = null;

  constructor() {
    super({ id: 'macro-calendar', title: 'Macro Calendar' });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.listEl = document.createElement('div');
    this.listEl.className = 'macro-calendar-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const indicators = await fetchMacroIndicators(INDICATOR_WATCHLIST);
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
        return `
        <div class="macro-event-row macro-impact-${impact}">
          <span class="macro-event-impact ${impact}">${impact.toUpperCase()}</span>
          <span class="macro-event-name">${ind.name}</span>
          <span class="macro-event-date">${ind.date || ''}</span>
          <span class="macro-event-value">${change}</span>
        </div>`;
      })
      .join('');
  }

  private formatValue(series: string, value: number): string {
    if (series === 'FEDFUNDS') return value.toFixed(2) + '%';
    if (series === 'UNRATE') return value.toFixed(1) + '%';
    if (series === 'CPIAUCSL' || series === 'PCE') return value.toFixed(1);
    if (series === 'GDP') return value.toFixed(1) + '%';
    return value.toLocaleString();
  }
}
