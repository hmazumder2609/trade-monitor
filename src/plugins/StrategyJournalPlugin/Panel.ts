import { Panel } from '@/components/Panel';
import {
  getStrategies,
  saveStrategy,
  deleteStrategy,
  type StrategyEntry,
} from '@/services/strategy-store';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface StrategyJournalSettings {
  sortBy: 'date' | 'symbol' | 'return' | 'confidence';
  showWinRate: boolean;
}

const SETTINGS_KEY = 'mdm-strategy-journal-settings';
const DEFAULT_SETTINGS: StrategyJournalSettings = { sortBy: 'date', showWinRate: true };

export class StrategyJournalPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private settings: StrategyJournalSettings;

  constructor() {
    super({
      id: 'strategy-journal',
      title: 'Strategy Journal',
      showCount: true,
    });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): StrategyJournalSettings {
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

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<StrategyJournalSettings>[] = [
      {
        key: 'showWinRate',
        label: 'Show win rate stats',
        type: 'checkbox',
      },
      {
        key: 'sortBy',
        label: 'Sort by',
        type: 'select',
        options: [
          { value: 'date', label: 'Date' },
          { value: 'symbol', label: 'Symbol' },
          { value: 'return', label: 'Return' },
          { value: 'confidence', label: 'Confidence' },
        ],
      },
    ];

    return createSettingsForm<StrategyJournalSettings>({
      title: 'Strategy Journal Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        this.saveSettings();
        this.refresh();
      },
    });
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ New Entry';
    addBtn.addEventListener('click', () => this.showEditor());
    this.content.appendChild(addBtn);

    this.listEl = document.createElement('div');
    this.listEl.className = 'strategy-journal-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const entries = getStrategies();
      this.render(entries);
      this.setCount(entries.length);
    } catch {
      this.showError('Failed to load journal', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(entries: StrategyEntry[]): void {
    if (!this.listEl) return;
    if (entries.length === 0) {
      this.listEl.innerHTML =
        '<div class="strategy-empty">No entries yet. Click "+ New Entry" to start your strategy journal.</div>';
      return;
    }

    const sorted = [...entries].sort((a, b) => {
      switch (this.settings.sortBy) {
        case 'symbol':
          return a.title.localeCompare(b.title);
        case 'date':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    let statsHtml = '';
    if (this.settings.showWinRate && sorted.length > 0) {
      statsHtml = `<div class="strategy-win-rate" style="padding:8px 12px;color:var(--text-muted);font-size:12px;border-bottom:1px solid var(--border-color);">${sorted.length} total entries</div>`;
    }

    this.listEl.innerHTML =
      statsHtml +
      sorted
        .map(
          e => `
        <div class="strategy-entry-card" data-id="${e.id}">
          <div class="strategy-entry-header">
            <span class="strategy-entry-title">${this.escape(e.title)}</span>
            <span class="strategy-entry-date">${new Date(e.updatedAt).toLocaleDateString()}</span>
          </div>
          <div class="strategy-entry-preview">${this.escape(e.content.slice(0, 120))}</div>
          <div class="strategy-entry-tags">
            ${e.tags.map(t => `<span class="strategy-tag">${this.escape(t)}</span>`).join('')}
            ${e.linkedTradeIds.length > 0 ? `<span class="strategy-tag trade-link">${e.linkedTradeIds.length} trade(s)</span>` : ''}
          </div>
          <div class="strategy-entry-actions">
            <button class="strategy-edit-btn" data-id="${e.id}">Edit</button>
            <button class="strategy-del-btn" data-id="${e.id}">Delete</button>
          </div>
        </div>`
        )
        .join('');

    this.listEl.querySelectorAll('.strategy-edit-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        const entry = getStrategies().find(s => s.id === id);
        if (entry) this.showEditor(entry);
      })
    );
    this.listEl.querySelectorAll('.strategy-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this entry?')) {
          deleteStrategy(id);
          this.refresh();
        }
      })
    );
  }

  private showEditor(entry?: StrategyEntry): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal strategy-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${entry ? 'Edit' : 'New'} Strategy Entry</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
        <input class="settings-input" id="strategyTitle" placeholder="Entry title" value="${entry ? this.escape(entry.title) : ''}" />
        <textarea class="settings-input strategy-textarea" id="strategyContent" placeholder="Write in markdown... (e.g. **Setup:**, ## Notes)">${entry ? this.escape(entry.content) : ''}</textarea>
        <input class="settings-input" id="strategyTags" placeholder="Tags (comma-separated)" value="${entry ? this.escape(entry.tags.join(', ')) : ''}" />
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="strategyCancel">Cancel</button>
          <button class="settings-save-btn" id="strategySave">${entry ? 'Update' : 'Save'}</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#strategyCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#strategySave')!.addEventListener('click', () => {
      const title = (modal.querySelector('#strategyTitle') as HTMLInputElement).value.trim();
      const content = (modal.querySelector('#strategyContent') as HTMLTextAreaElement).value.trim();
      if (!title || !content) return;
      const tags = (modal.querySelector('#strategyTags') as HTMLInputElement).value
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      saveStrategy({
        title,
        content,
        tags,
        linkedTradeIds: entry?.linkedTradeIds || [],
        ...(entry ? { id: entry.id } : {}),
      });
      overlay.remove();
      this.refresh();
    });

    (modal.querySelector('#strategyContent') as HTMLTextAreaElement).focus();
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
