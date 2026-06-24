import { Panel } from '@/components/Panel';
import {
  getPlaybooks,
  savePlaybook,
  updatePlaybook,
  deletePlaybook,
  type Playbook,
} from '@/services/strategy-store';

interface PlaybookManagerSettings {
  sortBy: 'date' | 'name' | 'status';
}

const SETTINGS_KEY = 'mdm-playbook-manager-settings';
const DEFAULT_SETTINGS: PlaybookManagerSettings = { sortBy: 'date' };

export class PlaybookManagerPanel extends Panel {
  private listEl: HTMLElement | null = null;
  private settings: PlaybookManagerSettings;

  constructor() {
    super({ id: 'playbook-manager', title: 'Playbook Manager', showCount: true });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.refresh();
  }

  private loadSettings(): PlaybookManagerSettings {
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
      <div class="social-settings-header">Playbook Manager Settings</div>
      <label class="social-settings-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
        Sort by:
        <select class="social-settings-select" id="pmSortBy">
          <option value="date" ${this.settings.sortBy === 'date' ? 'selected' : ''}>Date</option>
          <option value="name" ${this.settings.sortBy === 'name' ? 'selected' : ''}>Name</option>
          <option value="status" ${this.settings.sortBy === 'status' ? 'selected' : ''}>Status</option>
        </select>
      </label>
    `;

    el.querySelector('#pmSortBy')!.addEventListener('change', e => {
      this.settings.sortBy = (e.target as HTMLSelectElement)
        .value as PlaybookManagerSettings['sortBy'];
      this.saveSettings();
      this.refresh();
    });

    return el;
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const addBtn = document.createElement('button');
    addBtn.className = 'panel-add-btn';
    addBtn.textContent = '+ New Playbook';
    addBtn.addEventListener('click', () => this.showEditor());
    this.content.appendChild(addBtn);

    this.listEl = document.createElement('div');
    this.listEl.className = 'playbook-list';
    this.content.appendChild(this.listEl);
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const playbooks = getPlaybooks();
      this.render(playbooks);
      this.setCount(playbooks.length);
    } catch {
      this.showError('Failed to load playbooks', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(playbooks: Playbook[]): void {
    if (!this.listEl) return;
    if (playbooks.length === 0) {
      this.listEl.innerHTML =
        '<div class="strategy-empty">No playbooks yet. Create your first trading setup.</div>';
      return;
    }

    const sorted = [...playbooks].sort((a, b) => b.effectivenessScore - a.effectivenessScore);
    this.listEl.innerHTML = sorted
      .map(
        p => `
        <div class="playbook-card">
          <div class="playbook-header">
            <span class="playbook-name">${this.escape(p.name)}</span>
            <span class="playbook-score">${p.effectivenessScore}%</span>
          </div>
          <div class="playbook-meta">
            <span>${p.tradesCount} trades</span>
            <div class="playbook-bar"><div class="playbook-bar-fill" style="width:${p.effectivenessScore}%"></div></div>
          </div>
          <div class="playbook-desc">${this.escape(p.description)}</div>
          <div class="playbook-tags">${p.tags.map(t => `<span class="strategy-tag">${this.escape(t)}</span>`).join('')}</div>
          <div class="playbook-actions">
            <button class="strategy-edit-btn" data-id="${p.id}">Edit</button>
            <button class="strategy-del-btn" data-id="${p.id}">Delete</button>
          </div>
        </div>`
      )
      .join('');

    this.listEl.querySelectorAll('.strategy-edit-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        const pb = getPlaybooks().find(p => p.id === id);
        if (pb) this.showEditor(pb);
      })
    );
    this.listEl.querySelectorAll('.strategy-del-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (confirm('Delete this playbook?')) {
          deletePlaybook(id);
          this.refresh();
        }
      })
    );
  }

  private showEditor(playbook?: Playbook): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'modal playbook-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${playbook ? 'Edit' : 'New'} Playbook</span>
        <button class="modal-close">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;max-height:70vh;overflow-y:auto;">
        <input class="settings-input" id="pbName" placeholder="Playbook name" value="${playbook ? this.escape(playbook.name) : ''}" />
        <input class="settings-input" id="pbDesc" placeholder="Short description" value="${playbook ? this.escape(playbook.description) : ''}" />
        <textarea class="settings-input strategy-textarea" id="pbSetup" placeholder="Setup criteria (markdown)">${playbook ? this.escape(playbook.setup) : ''}</textarea>
        <textarea class="settings-input strategy-textarea" id="pbEntry" placeholder="Entry criteria">${playbook ? this.escape(playbook.entryCriteria) : ''}</textarea>
        <textarea class="settings-input strategy-textarea" id="pbExit" placeholder="Exit criteria">${playbook ? this.escape(playbook.exitCriteria) : ''}</textarea>
        <textarea class="settings-input strategy-textarea" id="pbRisk" placeholder="Risk management rules">${playbook ? this.escape(playbook.riskManagement) : ''}</textarea>
        <input class="settings-input" id="pbTags" placeholder="Tags (comma-separated)" value="${playbook ? this.escape(playbook.tags.join(', ')) : ''}" />
        <div style="display:flex;gap:8px;align-items:center;">
          <label>Effectiveness:</label>
          <input class="settings-input" id="pbScore" type="number" min="0" max="100" value="${playbook?.effectivenessScore ?? 50}" style="width:80px;" />
          <label>Trades:</label>
          <input class="settings-input" id="pbTrades" type="number" min="0" value="${playbook?.tradesCount ?? 0}" style="width:80px;" />
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="settings-cancel-btn" id="pbCancel">Cancel</button>
          <button class="settings-save-btn" id="pbSave">${playbook ? 'Update' : 'Save'}</button>
        </div>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#pbCancel')!.addEventListener('click', () => overlay.remove());
    modal.querySelector('#pbSave')!.addEventListener('click', () => {
      const name = (modal.querySelector('#pbName') as HTMLInputElement).value.trim();
      if (!name) return;
      const description = (modal.querySelector('#pbDesc') as HTMLInputElement).value.trim();
      const setup = (modal.querySelector('#pbSetup') as HTMLTextAreaElement).value.trim();
      const entryCriteria = (modal.querySelector('#pbEntry') as HTMLTextAreaElement).value.trim();
      const exitCriteria = (modal.querySelector('#pbExit') as HTMLTextAreaElement).value.trim();
      const riskManagement = (modal.querySelector('#pbRisk') as HTMLTextAreaElement).value.trim();
      const tags = (modal.querySelector('#pbTags') as HTMLInputElement).value
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const effectivenessScore = Math.min(
        100,
        Math.max(0, parseInt((modal.querySelector('#pbScore') as HTMLInputElement).value, 10) || 0)
      );
      const tradesCount =
        parseInt((modal.querySelector('#pbTrades') as HTMLInputElement).value, 10) || 0;

      if (playbook) {
        updatePlaybook(playbook.id, {
          name,
          description,
          setup,
          entryCriteria,
          exitCriteria,
          riskManagement,
          tags,
          effectivenessScore,
          tradesCount,
        });
      } else {
        savePlaybook({
          name,
          description,
          setup,
          entryCriteria,
          exitCriteria,
          riskManagement,
          tags,
          effectivenessScore,
          tradesCount,
        });
      }
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
