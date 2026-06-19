import { Panel } from '@/components/Panel';
import {
  getRoutines,
  saveRoutine,
  deleteRoutine,
  getHabits,
  type Routine,
} from '@/services/habit-store';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class RoutineSchedulerPanel extends Panel {
  private listEl: HTMLElement | null = null;

  constructor() {
    super({ id: 'routine-scheduler', title: 'Routine Scheduler', showCount: true });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ New Routine';
    addBtn.addEventListener('click', () => this.showEditor());
    this.content.appendChild(addBtn);

    this.listEl = document.createElement('div');
    this.listEl.className = 'routine-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const routines = getRoutines();
      this.render(routines);
      this.setCount(routines.length);
    } catch {
      this.showError('Failed to load routines', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(routines: Routine[]): void {
    if (!this.listEl) return;
    if (routines.length === 0) {
      this.listEl.innerHTML =
        '<div class="strategy-empty">No routines yet. Create your first daily routine.</div>';
      return;
    }
    const sorted = [...routines].sort((a, b) => (a.timeOfDay > b.timeOfDay ? 1 : -1));
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

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
