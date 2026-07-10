import { Panel } from '@/components/Panel';
import {
  getRoutines,
  saveRoutine,
  deleteRoutine,
  getHabits,
  type Routine,
} from '@/services/habit-store';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RoutineSchedulerSettings {
  sortBy: 'time' | 'name' | 'days';
  showCompleted: boolean;
}

const SETTINGS_KEY = 'mdm-routine-scheduler-settings';
const DEFAULT_SETTINGS: RoutineSchedulerSettings = { sortBy: 'time', showCompleted: true };

export class RoutineSchedulerPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private settings: RoutineSchedulerSettings;

  constructor() {
    super({
      id: 'routine-scheduler',
      title: 'Routine Scheduler',
      showCount: true,
    });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const actions = document.createElement('div');
    actions.className = 'panel-actions-row';
    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ New Routine';
    addBtn.addEventListener('click', () => this.showEditor());
    actions.appendChild(addBtn);
    this.content.appendChild(actions);

    this.listEl = document.createElement('div');
    this.listEl.className = 'routine-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      this.setDataWindow('This week');
      const routines = getRoutines();
      this.render(routines);
      this.setCount(routines.length);
    } catch {
      this.showError('Failed to load routines', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private loadSettings(): RoutineSchedulerSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  private render(routines: Routine[]): void {
    if (!this.listEl) return;
    if (routines.length === 0) {
      this.listEl.innerHTML =
        '<div class="strategy-empty">No routines yet. Create your first daily routine.</div>';
      return;
    }

    let filtered = routines;
    if (!this.settings.showCompleted) {
      filtered = routines.filter(r => {
        const days = r.daysOfWeek;
        const today = new Date().getDay();
        return days.length === 0 || days.includes(today);
      });
    }

    let sorted: Routine[];
    switch (this.settings.sortBy) {
      case 'name':
        sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'days':
        sorted = [...filtered].sort((a, b) => a.daysOfWeek.length - b.daysOfWeek.length);
        break;
      case 'time':
      default:
        sorted = [...filtered].sort((a, b) => (a.timeOfDay > b.timeOfDay ? 1 : -1));
        break;
    }

    this.listEl.innerHTML = sorted
      .map(
        r => `
        <div class="routine-card">
          <div class="routine-header">
            <span class="routine-name">${this.escape(r.name)}</span>
            <span class="routine-time">${this.escape(r.timeOfDay)}</span>
          </div>
          <div class="routine-desc">${this.escape(r.description)}</div>
          <div class="routine-days">
            ${r.daysOfWeek.map(d => `<span class="routine-day ${d === new Date().getDay() ? 'today' : ''}">${DAY_NAMES[d]}</span>`).join('')}
          </div>
          <div class="routine-actions">
            <button class="strategy-del-btn routine-del-btn" data-id="${r.id}">Delete</button>
          </div>
        </div>`
      )
      .join('');

    this.listEl.querySelectorAll('.routine-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this routine?')) {
          deleteRoutine(id);
          this.refresh();
        }
      })
    );
  }

  private showEditor(): void {
    const habits = getHabits();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">New Routine</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <input class="settings-input" id="rtName" placeholder="Routine name (e.g. Morning Stack)" />
        <input class="settings-input" id="rtDesc" placeholder="Description" />
        <input class="settings-input" id="rtTime" placeholder="Time of day (e.g. 07:00, Morning)" />
        <div class="routine-day-picker">
          ${DAY_NAMES.map((d, i) => `<label class="routine-day-label"><input type="checkbox" class="rt-day-cb" value="${i}" /> ${d}</label>`).join('')}
        </div>
        ${
          habits.length > 0
            ? `
        <div class="routine-habit-picker">
          <div class="settings-label">Include habits:</div>
          ${habits.map(h => `<label class="routine-habit-label"><input type="checkbox" class="rt-habit-cb" value="${h.id}" /> ${this.escape(h.name)}</label>`).join('')}
        </div>`
            : '<div class="settings-hint">No habits defined yet. Create habits first in Habit Tracker.</div>'
        }
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="rtCancel">Cancel</button>
          <button class="settings-save-btn" id="rtSave">Save</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#rtCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#rtSave')!.addEventListener('click', () => {
      const name = (modal.querySelector('#rtName') as HTMLInputElement).value.trim();
      if (!name) return;
      const description = (modal.querySelector('#rtDesc') as HTMLInputElement).value.trim();
      const timeOfDay = (modal.querySelector('#rtTime') as HTMLInputElement).value.trim();
      const daysOfWeek = [...modal.querySelectorAll<HTMLInputElement>('.rt-day-cb:checked')].map(
        cb => parseInt(cb.value, 10)
      );
      const habitIds = [...modal.querySelectorAll<HTMLInputElement>('.rt-habit-cb:checked')].map(
        cb => cb.value
      );
      saveRoutine({ name, description, timeOfDay, daysOfWeek, habitIds });
      overlay.remove();
      this.refresh();
    });
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<RoutineSchedulerSettings>[] = [
      {
        key: 'sortBy',
        label: 'Sort routines by',
        type: 'select',
        options: [
          { value: 'time', label: 'Time of day' },
          { value: 'name', label: 'Name' },
          { value: 'days', label: 'Number of days' },
        ],
      },
      { key: 'showCompleted', label: 'Show completed routines', type: 'checkbox' },
    ];

    return createSettingsForm<RoutineSchedulerSettings>({
      title: 'Routine Scheduler Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
        this.refresh();
      },
    });
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
