import { Panel } from '@/components/Panel';
import {
  getHabits,
  saveHabit,
  deleteHabit,
  getTodayLogs,
  saveHabitLog,
  getLogsForHabit,
  type Habit,
  type HabitLog,
} from '@/services/habit-store';

interface HabitTrackerSettings {
  showCompleted: boolean;
  sortBy: 'name' | 'category' | 'streak';
}

const SETTINGS_KEY = 'mdm-habit-tracker-settings';
const DEFAULT_SETTINGS: HabitTrackerSettings = { showCompleted: true, sortBy: 'name' };

export class HabitTrackerPanel extends Panel {
  private contentEl: HTMLElement | null = null;
  private settings: HabitTrackerSettings;

  constructor() {
    super({ id: 'habit-tracker', title: 'Habit Tracker', showCount: true });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): HabitTrackerSettings {
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

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ New Habit';
    addBtn.addEventListener('click', () => this.showHabitEditor());
    this.content.appendChild(addBtn);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'habit-tracker-list';
    this.content.appendChild(this.contentEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const habits = getHabits();
      const todayLogs = getTodayLogs();
      this.render(habits, todayLogs);
      this.setCount(habits.length);
    } catch {
      this.showError('Failed to load habits', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Habit Tracker Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" id="htShowCompleted" ${this.settings.showCompleted ? 'checked' : ''} />
        Show completed habits today
      </label>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Sort by:
        <select class="social-settings-select" id="htSortBy">
          <option value="name" ${this.settings.sortBy === 'name' ? 'selected' : ''}>Name</option>
          <option value="category" ${this.settings.sortBy === 'category' ? 'selected' : ''}>Category</option>
          <option value="streak" ${this.settings.sortBy === 'streak' ? 'selected' : ''}>Streak</option>
        </select>
      </label>
    `;

    el.querySelector('#htShowCompleted')!.addEventListener('change', e => {
      this.settings.showCompleted = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.refresh();
    });

    el.querySelector('#htSortBy')!.addEventListener('change', e => {
      this.settings.sortBy = (e.target as HTMLSelectElement)
        .value as HabitTrackerSettings['sortBy'];
      this.saveSettings();
      this.refresh();
    });

    return el;
  }

  private render(habits: Habit[], todayLogs: HabitLog[]): void {
    if (!this.contentEl) return;
    const loggedIds = new Set(todayLogs.map(l => l.habitId));

    let filtered = habits;
    if (!this.settings.showCompleted) {
      filtered = filtered.filter(h => !loggedIds.has(h.id));
    }

    if (filtered.length === 0) {
      this.contentEl.innerHTML =
        '<div class="strategy-empty">No habits yet. Create your first habit to track.</div>';
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      if (this.settings.sortBy === 'name') return a.name.localeCompare(b.name);
      if (this.settings.sortBy === 'category') return a.category.localeCompare(b.category);
      const streakA = this.calcStreak(getLogsForHabit(a.id));
      const streakB = this.calcStreak(getLogsForHabit(b.id));
      return streakB - streakA;
    });

    this.contentEl.innerHTML = sorted
      .map(h => {
        const done = loggedIds.has(h.id);
        const logs = getLogsForHabit(h.id);
        const streak = this.calcStreak(logs);
        return `
        <div class="habit-card ${done ? 'habit-done' : ''}">
          <div class="habit-card-header">
            <span class="habit-name">${this.escape(h.name)}</span>
            <span class="habit-category">${this.escape(h.category)}</span>
          </div>
          <div class="habit-meta">
            <span>Target: ${h.targetDuration} ${h.unit}</span>
            <span>Streak: ${streak} days</span>
          </div>
          <div class="habit-actions">
            ${
              done
                ? '<span class="habit-checked">✅ Done today</span>'
                : `<button class="trading-btn habit-log-btn" data-id="${h.id}" style="padding:2px 10px;font-size:11px;">Log Today</button>`
            }
            <button class="strategy-del-btn habit-del-btn" data-id="${h.id}" style="font-size:10px;">Delete</button>
          </div>
        </div>`;
      })
      .join('');

    this.contentEl.querySelectorAll('.habit-log-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        this.showLogDialog(id);
      })
    );
    this.contentEl.querySelectorAll('.habit-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this habit and all its logs?')) {
          deleteHabit(id);
          this.refresh();
        }
      })
    );
  }

  private calcStreak(logs: HabitLog[]): number {
    if (logs.length === 0) return 0;
    const dates = [...new Set(logs.map(l => l.date))].sort().reverse();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i] + 'T00:00:00');
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (d.toDateString() === expected.toDateString()) streak++;
      else break;
    }
    return streak;
  }

  private showHabitEditor(): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">New Habit</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <input class="settings-input" id="habitName" placeholder="Habit name (e.g. Morning meditation)" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="habitCategory" placeholder="Category (e.g. Mindfulness)" />
          <input class="settings-input" id="habitTarget" type="number" min="1" placeholder="Target (e.g. 15)" />
        </div>
        <select class="settings-input" id="habitUnit" style="padding:6px 8px;">
          <option value="min">minutes</option>
          <option value="hrs">hours</option>
          <option value="sets">sets</option>
          <option value="reps">reps</option>
          <option value="pages">pages</option>
          <option value="times">times</option>
        </select>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="habitCancel">Cancel</button>
          <button class="settings-save-btn" id="habitSave">Save</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#habitCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#habitSave')!.addEventListener('click', () => {
      const name = (modal.querySelector('#habitName') as HTMLInputElement).value.trim();
      const category = (modal.querySelector('#habitCategory') as HTMLInputElement).value.trim();
      const targetDuration =
        parseInt((modal.querySelector('#habitTarget') as HTMLInputElement).value, 10) || 0;
      const unit = (modal.querySelector('#habitUnit') as HTMLSelectElement).value;
      if (!name || targetDuration <= 0) return;
      saveHabit({ name, category: category || 'General', targetDuration, unit });
      overlay.remove();
      this.refresh();
    });
  }

  private showLogDialog(habitId: string): void {
    const habit = getHabits().find(h => h.id === habitId);
    if (!habit) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">Log: ${this.escape(habit.name)}</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <input class="settings-input" id="logDuration" type="number" min="0" step="1" placeholder="Duration (${habit.unit})" />
          <select class="settings-input" id="logQuality" style="padding:6px 8px;">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}">Quality: ${n}/10</option>`).join('')}
          </select>
        </div>
        <textarea class="settings-input strategy-textarea" id="logNotes" placeholder="Notes (optional)"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="logCancel">Cancel</button>
          <button class="settings-save-btn" id="logSave">Save</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#logCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#logSave')!.addEventListener('click', () => {
      const duration =
        parseFloat((modal.querySelector('#logDuration') as HTMLInputElement).value) || 0;
      const quality = parseInt((modal.querySelector('#logQuality') as HTMLSelectElement).value, 10);
      const notes = (modal.querySelector('#logNotes') as HTMLTextAreaElement).value.trim();
      saveHabitLog({
        habitId,
        date: new Date().toISOString().slice(0, 10),
        duration,
        quality,
        notes,
      });
      overlay.remove();
      this.refresh();
    });
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
