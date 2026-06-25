import { Panel } from '@/components/Panel';
import { fetchCalendarResult, type CalendarEvent } from '@/services/schedule';

interface ScheduleSettings {
  defaultView: 'day' | 'week' | 'month';
  showWeekends: boolean;
}

const SETTINGS_KEY = 'mdm-schedule-settings';
const DEFAULT_SETTINGS: ScheduleSettings = { defaultView: 'day', showWeekends: true };

export class SchedulePanel extends Panel {
  private settings: ScheduleSettings;

  constructor() {
    super({ id: 'schedule', title: 'Schedule', showCount: true, className: 'span-2' });
    this.settings = this.loadSettings();
    this.refresh();
  }

  private loadSettings(): ScheduleSettings {
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
      <div class="social-settings-header">Schedule Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Default view:
        <select class="social-settings-select" id="scDefaultView">
          <option value="day" ${this.settings.defaultView === 'day' ? 'selected' : ''}>Day</option>
          <option value="week" ${this.settings.defaultView === 'week' ? 'selected' : ''}>Week</option>
          <option value="month" ${this.settings.defaultView === 'month' ? 'selected' : ''}>Month</option>
        </select>
      </label>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        <input type="checkbox" id="scShowWeekends" ${this.settings.showWeekends ? 'checked' : ''} />
        Show weekends
      </label>
    `;

    el.querySelector('#scDefaultView')!.addEventListener('change', e => {
      this.settings.defaultView = (e.target as HTMLSelectElement)
        .value as ScheduleSettings['defaultView'];
      this.saveSettings();
      this.refresh();
    });

    el.querySelector('#scShowWeekends')!.addEventListener('change', e => {
      this.settings.showWeekends = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.refresh();
    });

    return el;
  }

  async refresh(): Promise<void> {
    if (this.isFetching) return;
    this.setFetching(true);
    try {
      const result = await fetchCalendarResult();
      if (!result.configured) {
        this.setContent(
          `<div class="panel-empty">${result.error || 'Google Calendar not configured.'}<br><br><small>Click <b>⚙ Settings</b> in the header to configure.</small></div>`
        );
        this.setDataBadge('unavailable');
        return;
      }
      if (result.error) {
        this.showError(result.error, () => this.refresh());
        return;
      }
      if (result.events.length === 0) {
        this.setContent('<div class="panel-empty">No events today</div>');
        this.setDataBadge('live');
        this.setCount(0);
        return;
      }
      this.render(result.events);
      this.setCount(result.events.length);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load schedule', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(events: CalendarEvent[]): void {
    const now = new Date();
    const rows = events
      .map(ev => {
        const start = new Date(ev.startTime);
        const end = new Date(ev.endTime);
        const isNow = now >= start && now <= end;
        const timeStr = ev.isAllDay
          ? 'All day'
          : `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
        return `
        <div class="schedule-item ${isNow ? 'schedule-now' : ''}">
          <span class="schedule-time">${timeStr}</span>
          <div class="schedule-info">
            <div class="schedule-title">${ev.title}</div>
            ${ev.location ? `<div class="schedule-location">${ev.location}</div>` : ''}
            ${ev.meetingLink ? `<a href="${ev.meetingLink}" target="_blank" class="schedule-link">Join meeting →</a>` : ''}
          </div>
        </div>`;
      })
      .join('');
    this.setContent(`<div class="schedule-list">${rows}</div>`);
  }
}
