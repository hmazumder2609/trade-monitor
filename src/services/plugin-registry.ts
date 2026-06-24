import { Panel } from '@/components/Panel';
import type { RefreshRegistration } from './refresh-scheduler';

export type TabId = 'dashboard' | 'macro' | 'news' | 'trading' | 'strategy' | 'personal' | 'devops';
export type DataSource = 'api' | 'local' | 'static';

export interface PluginManifest {
  id: string;
  name: string;
  tab: TabId;
  refreshIntervalMs?: number;
  dataSource: DataSource;
  routePath?: string;
  panel: Panel;
}

export interface CommandEntry {
  label: string;
  description: string;
  action: () => void;
  keywords?: string[];
}

export interface BootstrapResult {
  tabPanels: Record<string, Panel[]>;
  allPanels: Panel[];
  refreshTasks: RefreshRegistration[];
  commands: CommandEntry[];
  panelDefs: Record<string, { id: string; label: string }[]>;
}

class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();

  register(m: PluginManifest): void {
    if (this.plugins.has(m.id)) throw new Error(`Plugin '${m.id}' already registered`);
    this.plugins.set(m.id, m);
  }

  get(id: string): PluginManifest | undefined {
    return this.plugins.get(id);
  }

  getPanel(id: string): Panel | undefined {
    return this.plugins.get(id)?.panel;
  }

  getAllPanels(): Panel[] {
    return [...this.plugins.values()].map(m => m.panel);
  }

  getTabPanels(): Record<string, Panel[]> {
    const tabs: Record<string, Panel[]> = {};
    for (const m of this.plugins.values()) {
      if (!tabs[m.tab]) tabs[m.tab] = [];
      tabs[m.tab].push(m.panel);
    }
    return tabs;
  }

  getRefreshTasks(): RefreshRegistration[] {
    const tasks: RefreshRegistration[] = [];
    for (const m of this.plugins.values()) {
      if (m.refreshIntervalMs) {
        tasks.push({
          name: m.id,
          fn: () => m.panel.refresh(),
          intervalMs: m.refreshIntervalMs,
        });
      }
    }
    return tasks;
  }

  getCommandEntries(): CommandEntry[] {
    return [...this.plugins.values()].map(m => ({
      label: m.name,
      description: `Jump to ${m.name} panel`,
      action: () => {
        const tabId = m.tab;
        const panelEl = document.querySelector(`[data-panel="${m.id}"]`) as HTMLElement | null;
        if (!panelEl) return;
        const tabBtn = document.querySelector(`[data-tab="${tabId}"]`) as HTMLElement | null;
        tabBtn?.click();
        setTimeout(() => {
          panelEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          panelEl.classList.remove('panel-glow');
          void panelEl.offsetWidth;
          panelEl.classList.add('panel-glow');
          setTimeout(() => panelEl.classList.remove('panel-glow'), 2500);
        }, 100);
      },
      keywords: [m.id, m.name.toLowerCase()],
    }));
  }

  getPanelDefs(): Record<string, { id: string; label: string }[]> {
    const defs: Record<string, { id: string; label: string }[]> = {};
    for (const m of this.plugins.values()) {
      const tabLabel = m.tab.charAt(0).toUpperCase() + m.tab.slice(1);
      if (!defs[tabLabel]) defs[tabLabel] = [];
      defs[tabLabel].push({ id: m.id, label: m.name });
    }
    return defs;
  }

  buildTabPanels(preferences: {
    panelLayout?: Record<string, string[]>;
    hiddenPanels?: string[];
  }): {
    tabPanels: Record<string, Panel[]>;
    allPanels: Panel[];
  } {
    const defaults = this.getTabPanels();
    const { panelLayout = {} } = preferences;
    const result: Record<string, Panel[]> = {};
    const allPanels = new Map<string, Panel>();

    for (const m of this.plugins.values()) {
      allPanels.set(m.id, m.panel);
    }

    if (Object.keys(panelLayout).length > 0) {
      const placed = new Set<string>();
      for (const [tabName, panelIds] of Object.entries(panelLayout)) {
        const tabId = tabName.toLowerCase();
        result[tabId] = panelIds.map(id => allPanels.get(id)).filter(Boolean) as Panel[];
        for (const id of panelIds) placed.add(id);
      }
      for (const [tabId, panels] of Object.entries(defaults)) {
        if (!result[tabId]) result[tabId] = [];
        for (const p of panels) {
          const el = p.getElement();
          if (el.dataset.panel && !placed.has(el.dataset.panel)) {
            result[tabId].push(p);
          }
        }
      }
    } else {
      Object.assign(result, defaults);
    }

    const flatPanels = Object.values(result).flat();
    return { tabPanels: result, allPanels: flatPanels };
  }

  bootstrap(preferences?: {
    panelLayout?: Record<string, string[]>;
    hiddenPanels?: string[];
  }): BootstrapResult {
    const prefs = preferences || {};
    const { tabPanels, allPanels } = this.buildTabPanels(prefs);
    return {
      tabPanels,
      allPanels,
      refreshTasks: this.getRefreshTasks(),
      commands: this.getCommandEntries(),
      panelDefs: this.getPanelDefs(),
    };
  }
}

export const registry = new PluginRegistry();
