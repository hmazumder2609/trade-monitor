import { Panel } from '@/components/Panel';
import {
  fetchMacroHistory,
  fetchMacroIndicators,
  type MacroObservation,
  type MacroIndicator,
} from '@/services/macro';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

const ALL_BANKS = ['Fed', 'ECB', 'BOJ', 'BOE', 'PBOC'] as const;
type Bank = (typeof ALL_BANKS)[number];

interface CentralBankSettings {
  trackedBanks: Bank[];
}

type CentralBankFormSettings = Record<Bank, boolean>;

function cbArrayToSettings(arr: Bank[]): CentralBankFormSettings {
  const obj: any = {};
  for (const b of ALL_BANKS) obj[b] = arr.includes(b);
  return obj;
}

function cbSettingsToArray(settings: CentralBankFormSettings): Bank[] {
  return (ALL_BANKS as readonly Bank[]).filter(b => settings[b]) as Bank[];
}

const DEFAULT_CB_SETTINGS: CentralBankSettings = { trackedBanks: ['Fed'] };

export class CentralBankTrackerPanel extends Panel {
  private contentEl: HTMLElement | null = null;
  private settings: CentralBankSettings;

  constructor() {
    super({ id: 'central-bank-tracker', title: 'Central Bank Tracker' });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): CentralBankSettings {
    try {
      const raw = localStorage.getItem('mdm-central-bank-tracker-settings');
      if (raw) return { ...DEFAULT_CB_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_CB_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem('mdm-central-bank-tracker-settings', JSON.stringify(this.settings));
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.contentEl = this.content;
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const [indicators, history] = await Promise.all([
        fetchMacroIndicators(['FEDFUNDS']),
        fetchMacroHistory('FEDFUNDS', 60),
      ]);

      this.render(indicators, history.observations);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load central bank data', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(indicators: MacroIndicator[], history: MacroObservation[]): void {
    if (!this.contentEl) return;
    const fedRate = indicators.find(i => i.series === 'FEDFUNDS');

    const monthly = this.getMonthEndValues(history);
    const sorted = [...monthly].sort((a, b) => (b.date > a.date ? 1 : -1));

    const rate = fedRate?.value != null ? fedRate.value.toFixed(2) + '%' : '\u2014';
    const lastChange = sorted.length >= 2 ? sorted[0].value - sorted[1].value : 0;
    const direction = lastChange > 0 ? '\u25B2' : lastChange < 0 ? '\u25BC' : '\u25C6';
    const directionClass = lastChange > 0 ? 'rate-hike' : lastChange < 0 ? 'rate-cut' : 'rate-hold';

    this.contentEl.innerHTML = `
      <div class="cb-current-rate ${directionClass}">
        <div class="cb-rate-value">${rate}</div>
        <div class="cb-rate-label">Fed Funds Rate <span class="cb-direction">${direction}</span></div>
        <div class="cb-rate-date">${fedRate?.date || ''}</div>
      </div>
      <div class="cb-rate-history">
        <div class="cb-section-title">Rate Decisions (monthly)</div>
        ${sorted
          .slice(0, 12)
          .map((obs, i) => {
            const change = i < sorted.length - 1 ? sorted[i].value - sorted[i + 1].value : 0;
            const arrow = change > 0 ? '\u25B2 hike' : change < 0 ? '\u25BC cut' : '\u2014 hold';
            const arrowClass = change > 0 ? 'rate-hike' : change < 0 ? 'rate-cut' : '';
            return `
          <div class="cb-history-row ${arrowClass}">
            <span class="cb-history-date">${obs.date}</span>
            <span class="cb-history-rate">${obs.value.toFixed(2)}%</span>
            <span class="cb-history-change">${arrow}</span>
          </div>`;
          })
          .join('')}
      </div>`;
  }

  private getMonthEndValues(observations: MacroObservation[]): MacroObservation[] {
    const monthMap = new Map<string, MacroObservation>();
    for (const obs of observations) {
      const monthKey = obs.date.slice(0, 7);
      monthMap.set(monthKey, obs);
    }
    return Array.from(monthMap.values());
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<CentralBankFormSettings>[] = (ALL_BANKS as readonly Bank[]).map(
      bank => ({
        key: bank,
        label: bank,
        type: 'checkbox',
      })
    );

    return createSettingsForm<CentralBankFormSettings>({
      title: 'Central Banks to Track',
      schema,
      initialValues: cbArrayToSettings(this.settings.trackedBanks),
      onChange: vals => {
        this.settings.trackedBanks = cbSettingsToArray(vals);
        this.saveSettings();
        this.refresh();
      },
    });
  }
}
