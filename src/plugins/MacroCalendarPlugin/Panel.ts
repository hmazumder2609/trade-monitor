import { Panel } from '@/components/Panel';
import { fetchMacroIndicators, type MacroIndicator } from '@/services/macro';

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

export class MacroCalendarPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private trackedIndicators: string[];

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
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    const renderCheckboxes = () => {
      const list = el.querySelector('.social-settings-list');
      if (!list) return;
      list.innerHTML = ALL_INDICATORS.map(ind => {
        const checked = this.trackedIndicators.includes(ind) ? 'checked' : '';
        return `
            <label class="social-settings-label">
              <input type="checkbox" value="${ind}" ${checked} />
              <span>${ind}</span>
            </label>`;
      }).join('');

      list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (!this.trackedIndicators.includes(cb.value)) {
              this.trackedIndicators.push(cb.value);
            }
          } else {
            this.trackedIndicators = this.trackedIndicators.filter(i => i !== cb.value);
          }
          saveTrackedIndicators(this.trackedIndicators);
          this.refresh();
        });
      });
    };

    el.innerHTML = `
      <div class="social-settings-header">Tracked Indicators</div>
      <div class="social-settings-list"></div>
    `;

    renderCheckboxes();

    return el;
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const indicators = await fetchMacroIndicators(this.trackedIndicators);
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
