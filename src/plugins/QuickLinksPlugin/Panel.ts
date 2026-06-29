import { Panel } from '@/components/Panel';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface QuickLink {
  name: string;
  url: string;
  icon: string;
  color: string;
  description: string;
}

const STORAGE_KEY = 'mdm-quick-links';

const DEFAULT_LINKS: QuickLink[] = [
  {
    name: 'Twitter / X',
    url: 'https://x.com/home',
    icon: '𝕏',
    color: '#1da1f2',
    description: 'Timeline',
  },
  {
    name: 'Xiaohongshu',
    url: 'https://www.xiaohongshu.com/explore',
    icon: '📕',
    color: '#ff2d55',
    description: 'Explore',
  },
  {
    name: 'GitHub',
    url: 'https://github.com',
    icon: '🐙',
    color: '#8b5cf6',
    description: 'Repos & PRs',
  },
  {
    name: 'Gmail',
    url: 'https://mail.google.com',
    icon: '📧',
    color: '#ea4335',
    description: 'Inbox',
  },
  {
    name: 'Google Calendar',
    url: 'https://calendar.google.com',
    icon: '📅',
    color: '#4285f4',
    description: 'Events',
  },
  {
    name: 'Feishu',
    url: 'https://www.feishu.cn',
    icon: '💬',
    color: '#3370ff',
    description: 'Messages',
  },
  {
    name: 'Notion',
    url: 'https://notion.so',
    icon: '📝',
    color: '#fff',
    description: 'Notes & Docs',
  },
  {
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    icon: '🤖',
    color: '#10a37f',
    description: 'AI Chat',
  },
];

function loadLinks(): QuickLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...DEFAULT_LINKS];
}

function saveLinks(links: QuickLink[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export class QuickLinksPanel extends Panel {
  private links: QuickLink[];

  constructor() {
    super({ id: 'quick-links', title: 'Quick Links', showCount: false });
    this.links = loadLinks();
    this.render();
  }

  private render(): void {
    const grid = this.links
      .map(
        l => `
      <a href="${l.url}" target="_blank" rel="noopener" class="ql-item" title="${l.description}">
        <span class="ql-icon" style="background:${l.color}20;color:${l.color}">${l.icon}</span>
        <span class="ql-name">${l.name}</span>
      </a>
    `
      )
      .join('');

    const addBtn = `<button class="ql-add" id="qlAddBtn" title="Add link">+</button>`;

    this.setContent(`<div class="ql-grid">${grid}${addBtn}</div>`);

    this.content.querySelector('#qlAddBtn')?.addEventListener('click', () => {
      this.toggleSettingsPopover();
    });
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<Record<string, unknown>>[] = [
      {
        key: 'links',
        label: 'Manage Links',
        type: 'sortable-list',
        itemFields: [
          { key: 'name', label: 'Name', type: 'text', placeholder: 'Link name' },
          { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...' },
          { key: 'icon', label: 'Icon', type: 'text', placeholder: 'Emoji', width: 40 },
          { key: 'color', label: 'Color', type: 'color' },
          { key: 'description', label: 'Description', type: 'text', placeholder: 'Tooltip text' },
        ],
      },
    ];

    return createSettingsForm({
      title: 'Quick Links',
      schema,
      initialValues: { links: this.links },
      onChange: vals => {
        this.links = (vals.links as QuickLink[]) || [];
        saveLinks(this.links);
        this.render();
      },
    });
  }

  async refresh(): Promise<void> {
    this.links = loadLinks();
    this.render();
  }
}
