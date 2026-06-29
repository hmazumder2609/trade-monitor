import { Panel } from '@/components/Panel';
import { fetchCalendarResult, type CalendarEvent } from '@/services/schedule';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

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
    const schema: SettingSchema<ScheduleSettings>[] = [
      {
        key: 'defaultView',
        label: 'Default view',
        type: 'select',
        options: [
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ],
      },
      {
        key: 'showWeekends',
        label: 'Show weekends',
        type: 'checkbox',
      },
    ];

    return createSettingsForm<ScheduleSettings>({
      title: 'Schedule Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
        this.refresh();
      },
    });
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
