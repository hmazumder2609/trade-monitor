import { Panel } from '@/components/Panel';
import {
  getCheckIns,
  getTodayCheckIn,
  saveCheckIn,
  type MentalCheckIn,
} from '@/services/habit-store';

interface MentalCheckInSettings {
  moodScale: '1-5' | '1-10';
  showHistory: boolean;
}

const SETTINGS_KEY = 'mdm-mental-checkin-settings';
const DEFAULT_SETTINGS: MentalCheckInSettings = { moodScale: '1-10', showHistory: true };

export class MentalCheckInPanel extends Panel {
  private contentEl: HTMLElement | null = null;
  private settings: MentalCheckInSettings;

  constructor() {
    super({ id: 'mental-checkin', title: 'Mental Check-In', showCount: true });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): MentalCheckInSettings {
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
      <div class="social-settings-header">Mental Check-In Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Mood scale:
        <select class="social-settings-select" id="mcMoodScale">
          <option value="1-5" ${this.settings.moodScale === '1-5' ? 'selected' : ''}>1–5</option>
          <option value="1-10" ${this.settings.moodScale === '1-10' ? 'selected' : ''}>1–10</option>
        </select>
      </label>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" id="mcShowHistory" ${this.settings.showHistory ? 'checked' : ''} />
        Show history
      </label>
    `;

    el.querySelector('#mcMoodScale')!.addEventListener('change', e => {
      this.settings.moodScale = (e.target as HTMLSelectElement)
        .value as MentalCheckInSettings['moodScale'];
      this.saveSettings();
      this.refresh();
    });

    el.querySelector('#mcShowHistory')!.addEventListener('change', e => {
      this.settings.showHistory = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.refresh();
    });

    return el;
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.contentEl = this.content;
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const today = getTodayCheckIn();
      const history = getCheckIns();
      this.render(today, history);
      this.setCount(history.length);
    } catch {
      this.showError('Failed to load check-ins', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(today: MentalCheckIn | undefined, history: MentalCheckIn[]): void {
    if (!this.contentEl) return;

    if (!today) {
      this.contentEl.innerHTML = `
        <div class="checkin-prompt">
          <div class="checkin-question">How are you feeling today?</div>
          <button class="trading-btn" id="checkinStartBtn" style="width:100%;padding:10px;">Start Check-In</button>
        </div>
        ${history.length > 0 ? '<div class="cb-section-title" style="margin-top:16px;">Recent</div>' : ''}
      `;
      this.contentEl
        .querySelector('#checkinStartBtn')
        ?.addEventListener('click', () => this.showEditor());
    } else {
      this.contentEl.innerHTML = `
        <div class="checkin-today">
          <div class="checkin-today-header">Today's Check-In</div>
          <div class="checkin-scores">
            <div class="checkin-score"><span class="checkin-label">Mood</span><span class="checkin-value" style="color:${this.scoreColor(today.mood)}">${today.mood}/10</span></div>
            <div class="checkin-score"><span class="checkin-label">Energy</span><span class="checkin-value" style="color:${this.scoreColor(today.energy)}">${today.energy}/10</span></div>
            <div class="checkin-score"><span class="checkin-label">Stress</span><span class="checkin-value" style="color:${this.scoreColor(10 - today.stress)}">${today.stress}/10</span></div>
          </div>
          ${today.notes ? `<div class="checkin-notes">${this.escape(today.notes)}</div>` : ''}
          <button class="trading-btn" id="checkinEditBtn" style="padding:4px 12px;font-size:11px;">Update</button>
        </div>
      `;
      this.contentEl
        .querySelector('#checkinEditBtn')
        ?.addEventListener('click', () => this.showEditor(today));
    }

    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => (b.date > a.date ? 1 : -1)).slice(1, 8);
      if (sorted.length > 0) {
        let html = '<div class="checkin-history"><div class="cb-section-title">Recent</div>';
        html += sorted
          .map(
            c => `
          <div class="checkin-history-row">
            <span class="checkin-history-date">${c.date}</span>
            <span class="checkin-history-mood" style="color:${this.scoreColor(c.mood)}">😀${c.mood}</span>
            <span class="checkin-history-energy" style="color:${this.scoreColor(c.energy)}">⚡${c.energy}</span>
            <span class="checkin-history-stress" style="color:${this.scoreColor(10 - c.stress)}">💥${c.stress}</span>
          </div>`
          )
          .join('');
        html += '</div>';
        if (this.contentEl && !today) {
          const existing = this.contentEl.querySelector('.checkin-history');
          if (!existing) this.contentEl.insertAdjacentHTML('beforeend', html);
        } else if (this.contentEl) {
          this.contentEl.insertAdjacentHTML('beforeend', html);
        }
      }
    }
  }

  private showEditor(existing?: MentalCheckIn): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${existing ? 'Update' : 'Daily'} Check-In</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
        <div class="checkin-slider-group">
          <label>Mood: <span id="ciMoodVal">${existing?.mood ?? 7}</span>/10</label>
          <input type="range" id="ciMood" min="1" max="10" value="${existing?.mood ?? 7}" />
        </div>
        <div class="checkin-slider-group">
          <label>Energy: <span id="ciEnergyVal">${existing?.energy ?? 7}</span>/10</label>
          <input type="range" id="ciEnergy" min="1" max="10" value="${existing?.energy ?? 7}" />
        </div>
        <div class="checkin-slider-group">
          <label>Stress: <span id="ciStressVal">${existing?.stress ?? 4}</span>/10</label>
          <input type="range" id="ciStress" min="1" max="10" value="${existing?.stress ?? 4}" />
        </div>
        <textarea class="settings-input strategy-textarea" id="ciNotes" placeholder="How was your day? Any wins or challenges?">${existing ? this.escape(existing.notes) : ''}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="ciCancel">Cancel</button>
          <button class="settings-save-btn" id="ciSave">${existing ? 'Update' : 'Save'}</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const wireSlider = (id: string, valId: string) => {
      const slider = modal.querySelector(`#${id}`) as HTMLInputElement;
      const val = modal.querySelector(`#${valId}`);
      slider?.addEventListener('input', () => {
        if (val) val.textContent = slider.value;
      });
    };
    wireSlider('ciMood', 'ciMoodVal');
    wireSlider('ciEnergy', 'ciEnergyVal');
    wireSlider('ciStress', 'ciStressVal');

    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#ciCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#ciSave')!.addEventListener('click', () => {
      const mood = parseInt((modal.querySelector('#ciMood') as HTMLInputElement).value, 10);
      const energy = parseInt((modal.querySelector('#ciEnergy') as HTMLInputElement).value, 10);
      const stress = parseInt((modal.querySelector('#ciStress') as HTMLInputElement).value, 10);
      const notes = (modal.querySelector('#ciNotes') as HTMLTextAreaElement).value.trim();
      saveCheckIn({ date: new Date().toISOString().slice(0, 10), mood, energy, stress, notes });
      overlay.remove();
      this.refresh();
    });
  }

  private scoreColor(score: number): string {
    if (score >= 8) return 'var(--green)';
    if (score >= 5) return 'var(--yellow)';
    return 'var(--red)';
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
