import { Panel } from '@/components/Panel';
import {
  getHealthMetrics,
  saveHealthMetric,
  deleteHealthMetric,
  type HealthMetric,
} from '@/services/habit-store';

const METRIC_TYPES = [
  'Sleep',
  'Exercise',
  'Water',
  'Steps',
  'Weight',
  'Heart Rate',
  'Blood Pressure',
  'Screen Time',
];

const SETTINGS_KEY = 'mdm-health-metrics-settings';

interface HealthMetricsSettings {
  defaultUnit: string;
  showDeleted: boolean;
}

function loadSettings(): HealthMetricsSettings {
  try {
    return {
      defaultUnit: 'default',
      showDeleted: false,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    };
  } catch {
    return { defaultUnit: 'default', showDeleted: false };
  }
}

function saveSettings(s: HealthMetricsSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export class HealthMetricsPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private settings: HealthMetricsSettings = loadSettings();

  constructor() {
    super({ id: 'health-metrics', title: 'Health Metrics', showCount: true });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ Add Metric';
    addBtn.addEventListener('click', () => this.showEditor());
    this.content.appendChild(addBtn);

    this.listEl = document.createElement('div');
    this.listEl.className = 'health-metrics-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const metrics = getHealthMetrics();
      this.render(metrics);
      this.setCount(metrics.length);
    } catch {
      this.showError('Failed to load health metrics', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(metrics: HealthMetric[]): void {
    if (!this.listEl) return;
    if (metrics.length === 0) {
      this.listEl.innerHTML = '<div class="strategy-empty">No health metrics logged yet.</div>';
      return;
    }
    const sorted = [...metrics].sort((a, b) => (b.date > a.date ? 1 : -1));
    this.listEl.innerHTML = sorted
      .map(
        m => `
        <div class="health-metric-card">
          <div class="health-metric-header">
            <span class="health-metric-type">${this.escape(m.type)}</span>
            <span class="health-metric-value">${m.value} ${m.unit}</span>
          </div>
          <div class="health-metric-date">${m.date}</div>
          ${m.notes ? `<div class="health-metric-notes">${this.escape(m.notes)}</div>` : ''}
          <button class="strategy-del-btn health-del-btn" data-id="${m.id}">Delete</button>
        </div>`
      )
      .join('');

    this.listEl.querySelectorAll('.health-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this metric?')) {
          deleteHealthMetric(id);
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
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">Log Health Metric</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <select class="settings-input" id="hmType" style="padding:6px 8px;">
          ${METRIC_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="hmValue" type="number" step="0.1" placeholder="Value" />
          <input class="settings-input" id="hmUnit" placeholder="Unit (e.g. hrs, kg, bpm)" />
        </div>
        <input class="settings-input" id="hmDate" type="date" />
        <textarea class="settings-input strategy-textarea" id="hmNotes" placeholder="Notes"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="hmCancel">Cancel</button>
          <button class="settings-save-btn" id="hmSave">Save</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    (modal.querySelector('#hmDate') as HTMLInputElement).value = new Date()
      .toISOString()
      .slice(0, 10);
    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#hmCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#hmSave')!.addEventListener('click', () => {
      const type = (modal.querySelector('#hmType') as HTMLSelectElement).value;
      const value = parseFloat((modal.querySelector('#hmValue') as HTMLInputElement).value) || 0;
      const unit = (modal.querySelector('#hmUnit') as HTMLInputElement).value.trim();
      const date = (modal.querySelector('#hmDate') as HTMLInputElement).value;
      const notes = (modal.querySelector('#hmNotes') as HTMLTextAreaElement).value.trim();
      if (!type || !unit) return;
      saveHealthMetric({ type, value, unit, date, notes });
      overlay.remove();
      this.refresh();
    });
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Health Metrics Settings</div>
      <div class="social-settings-row">
        <label class="social-settings-label" for="hmDefaultUnit">Default unit for new metrics</label>
        <select class="social-settings-select" id="hmDefaultUnit">
          <option value="default">Default</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="mg/dL">mg/dL</option>
          <option value="bpm">bpm</option>
          <option value="steps">Steps</option>
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
      </div>
      <div class="social-settings-row">
        <label class="social-settings-label" for="hmShowDeleted">Show deleted metrics</label>
        <input type="checkbox" class="social-settings-checkbox" id="hmShowDeleted" />
      </div>
    `;

    const unitSelect = el.querySelector('#hmDefaultUnit') as HTMLSelectElement;
    unitSelect.value = this.settings.defaultUnit;
    unitSelect.addEventListener('change', () => {
      this.settings.defaultUnit = unitSelect.value;
      saveSettings(this.settings);
    });

    const showDeletedCb = el.querySelector('#hmShowDeleted') as HTMLInputElement;
    showDeletedCb.checked = this.settings.showDeleted;
    showDeletedCb.addEventListener('change', () => {
      this.settings.showDeleted = showDeletedCb.checked;
      saveSettings(this.settings);
    });

    return el;
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
