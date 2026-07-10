import { Panel } from '@/components/Panel';
import { fetchEmailResult, type EmailMessage } from '@/services/email';
import { formatTime, escapeHtml } from '@/utils';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface EmailSettings {
  defaultInbox: 'gmail' | 'outlook';
  showNotifications: boolean;
}

const STORAGE_KEY = 'mdm-email-settings';

function loadSettings(): EmailSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultSettings };
}

function saveSettings(settings: EmailSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const defaultSettings: EmailSettings = { defaultInbox: 'gmail', showNotifications: true };

export class EmailPanel extends Panel {
  private settings: EmailSettings;

  constructor() {
    super({ id: 'email', title: 'Email', showCount: true });
    this.settings = loadSettings();
    this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.isFetching) return;
    this.setFetching(true);
    try {
      this.setDataWindow('Last 24h');
      const result = await fetchEmailResult();
      if (!result.configured) {
        this.setContent(
          `<div class="panel-empty">${result.error || 'Gmail not configured.'}<br><br><small>Click <b>⚙ Settings</b> to configure.</small></div>`
        );
        this.setDataBadge('unavailable');
        return;
      }
      if (result.error) {
        this.showError(result.error, () => this.refresh());
        return;
      }
      this.render(result.emails);
      this.setCount(result.emails.filter(e => e.unread).length);
      this.setDataBadge('live');
    } catch {
      this.showError('Failed to load emails', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(emails: EmailMessage[]): void {
    if (emails.length === 0) {
      this.setContent('<div class="panel-empty">Inbox zero! 🎉</div>');
      return;
    }
    const rows = emails
      .map(
        e => `
      <div class="email-item ${e.unread ? 'unread' : ''}">
        <span class="email-dot"></span>
        <div style="flex:1;min-width:0;">
          <div class="email-subject">${escapeHtml(e.subject)}</div>
          <div class="email-meta">
            <span class="email-from">${escapeHtml(e.from)}</span>
            <span class="email-time">${formatTime(new Date(e.receivedAt))}</span>
          </div>
        </div>
      </div>`
      )
      .join('');
    this.setContent(`<div class="email-list">${rows}</div>`);
  }

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<EmailSettings>[] = [
      {
        key: 'defaultInbox',
        label: 'Default Inbox',
        type: 'select',
        options: [
          { value: 'gmail', label: 'Gmail' },
          { value: 'outlook', label: 'Outlook' },
        ],
      },
      {
        key: 'showNotifications',
        label: 'Show notifications',
        type: 'checkbox',
      },
    ];

    return createSettingsForm<EmailSettings>({
      title: 'Email Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        saveSettings(this.settings);
        this.refresh();
      },
    });
  }
}
