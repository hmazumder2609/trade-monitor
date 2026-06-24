import { Panel } from '@/components/Panel';

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

    this.setContent(`<div class="ql-grid">${grid}</div>`);
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'ql-settings';

    const renderList = () => {
      const list = el.querySelector('.ql-settings-list');
      if (!list) return;
      list.innerHTML = this.links
        .map(
          (l, i) => `
        <div class="ql-settings-item" data-idx="${i}">
          <span class="ql-settings-drag" title="Drag to reorder">⠿</span>
          <span class="ql-settings-icon" style="color:${l.color}">${l.icon}</span>
          <span class="ql-settings-name">${l.name}</span>
          <span class="ql-settings-url">${l.url}</span>
          <button class="ql-settings-remove" data-idx="${i}" title="Remove">&times;</button>
        </div>
      `
        )
        .join('');

      // Wire remove buttons
      list.querySelectorAll<HTMLButtonElement>('.ql-settings-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx!, 10);
          this.links.splice(idx, 1);
          saveLinks(this.links);
          renderList();
          this.render();
        });
      });

      // Wire drag to reorder
      let dragIdx: number | null = null;
      list.querySelectorAll<HTMLElement>('.ql-settings-item').forEach(item => {
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', () => {
          dragIdx = parseInt(item.dataset.idx!, 10);
          item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
          dragIdx = null;
          item.classList.remove('dragging');
        });
        item.addEventListener('dragover', e => {
          e.preventDefault();
          const targetIdx = parseInt(item.dataset.idx!, 10);
          if (dragIdx === null || dragIdx === targetIdx) return;
          const dragged = this.links.splice(dragIdx, 1)[0];
          this.links.splice(targetIdx, 0, dragged);
          dragIdx = targetIdx;
          saveLinks(this.links);
          renderList();
          this.render();
        });
      });
    };

    el.innerHTML = `
      <div class="ql-settings-header">Manage Links</div>
      <div class="ql-settings-list"></div>
      <div class="ql-settings-add">
        <input type="text" class="ql-settings-input" id="qlName" placeholder="Name" />
        <input type="url" class="ql-settings-input" id="qlUrl" placeholder="URL" />
        <input type="text" class="ql-settings-input" id="qlIcon" placeholder="Icon (emoji)" maxlength="4" />
        <input type="color" class="ql-settings-color" id="qlColor" value="#3b82f6" />
        <button class="ql-settings-add-btn" id="qlAddBtn">Add</button>
      </div>
    `;

    renderList();

    // Wire add button
    const addBtn = el.querySelector('#qlAddBtn')!;
    addBtn.addEventListener('click', () => {
      const name = (el.querySelector('#qlName') as HTMLInputElement).value.trim();
      const url = (el.querySelector('#qlUrl') as HTMLInputElement).value.trim();
      const icon = (el.querySelector('#qlIcon') as HTMLInputElement).value.trim() || '🔗';
      const color = (el.querySelector('#qlColor') as HTMLInputElement).value;

      if (!name || !url) return;

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return;
      }

      this.links.push({ name, url, icon, color, description: name });
      saveLinks(this.links);

      // Clear inputs
      (el.querySelector('#qlName') as HTMLInputElement).value = '';
      (el.querySelector('#qlUrl') as HTMLInputElement).value = '';
      (el.querySelector('#qlIcon') as HTMLInputElement).value = '';

      renderList();
      this.render();
    });

    // Allow Enter key to add
    el.querySelectorAll<HTMLInputElement>('.ql-settings-input').forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') (addBtn as HTMLElement).click();
      });
    });

    return el;
  }

  async refresh(): Promise<void> {
    this.links = loadLinks();
    this.render();
  }
}
