import { Panel } from '@/components/Panel';
import { fetchEmailResult, type EmailMessage } from '@/services/email';
import { formatTime, escapeHtml } from '@/utils';

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
        <div class="email-subject">${escapeHtml(e.subject)}</div>
        <div class="email-meta">
          <span class="email-from">${escapeHtml(e.from)}</span>
          <span class="email-time">${formatTime(new Date(e.receivedAt))}</span>
        </div>
      </div>`
      )
      .join('');
    this.setContent(`<div class="email-list">${rows}</div>`);
  }

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    el.innerHTML = `
      <div class="social-settings-header">Email Settings</div>
      <label class="social-settings-label">
        <span>Default Inbox</span>
        <select class="social-settings-select" id="emailInbox">
          <option value="gmail" ${this.settings.defaultInbox === 'gmail' ? 'selected' : ''}>Gmail</option>
          <option value="outlook" ${this.settings.defaultInbox === 'outlook' ? 'selected' : ''}>Outlook</option>
        </select>
      </label>
      <label class="social-settings-label">
        <input type="checkbox" id="emailNotif" ${this.settings.showNotifications ? 'checked' : ''} />
        <span>Show notifications</span>
      </label>
    `;

    el.querySelector('#emailInbox')?.addEventListener('change', e => {
      this.settings.defaultInbox = (e.target as HTMLSelectElement).value as 'gmail' | 'outlook';
      saveSettings(this.settings);
      this.refresh();
    });

    el.querySelector('#emailNotif')?.addEventListener('change', e => {
      this.settings.showNotifications = (e.target as HTMLInputElement).checked;
      saveSettings(this.settings);
    });

    return el;
  }
}
