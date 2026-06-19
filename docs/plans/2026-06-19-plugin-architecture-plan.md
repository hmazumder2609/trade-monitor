# Plugin Architecture — Implementation Plan

**Goal:** Build `PluginRegistry` infrastructure then migrate the 3 Social Sentiment 2.0 panels into `src/plugins/` as a proof of concept.

**Architecture:** A `PluginRegistry` singleton collects `PluginManifest` objects from each plugin's self-registration call. It produces all data structures previously built manually in `main.ts`: tab panels, scheduler tasks, command entries, route maps, and visibility defs.

**Tech Stack:** TypeScript, vanilla DOM panels, Express routes, Panel base class.

---

### Task 0: Create PluginRegistry

**Files:**
- Create: `src/services/plugin-registry.ts`

**Step 1: Write the PluginRegistry class**

```typescript
import { Panel } from '@/components/Panel';
import type { RefreshRegistration } from './refresh-scheduler';

type TabId = 'dashboard' | 'macro' | 'news' | 'trading' | 'strategy' | 'habits' | 'devops';
type DataSource = 'api' | 'local' | 'static';
type RouteHandler = (query: Record<string, string>, body: string, headers: Record<string, string | string[] | undefined>) => Promise<unknown>;

interface PluginManifest {
  id: string;
  name: string;
  tab: TabId;
  refreshIntervalMs?: number;
  dataSource: DataSource;
  routePath?: string;
  panel: Panel;
  routeHandler?: RouteHandler;
}

interface CommandEntry {
  label: string;
  description: string;
  action: () => void;
  keywords?: string[];
}

class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();

  register(m: PluginManifest): void {
    if (this.plugins.has(m.id)) throw new Error(`Plugin '${m.id}' already registered`);
    this.plugins.set(m.id, m);
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
        // Switch tab
        const tabBtn = document.querySelector(`[data-tab="${tabId}"]`) as HTMLElement | null;
        tabBtn?.click();
        // Scroll to panel with glow
        setTimeout(() => {
          panelEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          panelEl.classList.remove('panel-glow');
          void panelEl.offsetWidth;
          panelEl.classList.add('panel-glow');
          setTimeout(() => panelEl.classList.remove('panel-glow'), 2500);
        }, 100);
      },
      keywords: [m.id, ...m.name.toLowerCase().split(' ')],
    }));
  }

  getRouteMap(): { routes: Record<string, RouteHandler>; prefixRoutes: Record<string, RouteHandler> } {
    const routes: Record<string, RouteHandler> = {};
    const prefixRoutes: Record<string, RouteHandler> = {};
    for (const m of this.plugins.values()) {
      if (m.routePath && m.routeHandler) {
        routes[m.routePath] = m.routeHandler;
      }
    }
    return { routes, prefixRoutes };
  }

  /** Returns TAB_PANEL_DEFS format for SettingsModal */
  getPanelDefs(): Record<string, { id: string; label: string }[]> {
    const defs: Record<string, { id: string; label: string }[]> = {};
    for (const m of this.plugins.values()) {
      const tabLabel = m.tab.charAt(0).toUpperCase() + m.tab.slice(1);
      if (!defs[tabLabel]) defs[tabLabel] = [];
      defs[tabLabel].push({ id: m.id, label: m.name });
    }
    return defs;
  }

  buildTabPanels(preferences: { panelLayout?: Record<string, string[]>; hiddenPanels?: string[] }): {
    tabPanels: Record<string, Panel[]>;
    allPanels: Panel[];
  } {
    const defaults = this.getTabPanels();
    const { panelLayout = {} } = preferences;
    const result: Record<string, Panel[]> = {};

    if (Object.keys(panelLayout).length > 0) {
      const placed = new Set<string>();
      for (const [tabName, panelIds] of Object.entries(panelLayout)) {
        const tabId = tabName.toLowerCase();
        result[tabId] = panelIds.map(id => this.getPanel(id)).filter(Boolean) as Panel[];
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

    const allPanels = Object.values(result).flat();
    return { tabPanels: result, allPanels };
  }

  bootstrap(preferences?: { panelLayout?: Record<string, string[]>; hiddenPanels?: string[] }) {
    const prefs = preferences || (typeof window !== 'undefined' ? {} : {});
    const { tabPanels, allPanels } = this.buildTabPanels(prefs);
    return { tabPanels, allPanels, refreshTasks: this.getRefreshTasks(), commands: this.getCommandEntries() };
  }
}

export const registry = new PluginRegistry();
export type { PluginManifest, DataSource, TabId, CommandEntry };
```

**Step 2: Verify type check**

Run: `npx tsc --noEmit` and `npx tsc -p tsconfig.server.json --noEmit`
Expected: 0 errors

**Step 3: Create the plugins directory**

Run: `mkdir -p src/plugins`

---

### Task 1: Migrate RedditPulsePlugin

**Files:**
- Create: `src/plugins/RedditPulsePlugin/plugin.ts`
- Create: `src/plugins/RedditPulsePlugin/Panel.ts`
- Create: `src/plugins/RedditPulsePlugin/service.ts`
- Create: `src/plugins/RedditPulsePlugin/route.ts`
- Modify: `src/main.ts` — add import, remove old registration spots
- Modify: `vite-api-plugin.ts` — remove old import + route entry, add registry loader
- Modify: `server/index.ts` — same
- Modify: `src/components/index.ts` — remove RedditPulsePanel export
- Modify: `src/services/index.ts` — remove reddit-pulse exports
- Modify: `src/components/SettingsModal.ts` — use registry.getPanelDefs() or add plugin entries
- Delete: `src/components/RedditPulsePanel.ts`
- Delete: `src/services/reddit-pulse.ts`
- Delete: `server/routes/reddit-pulse.ts`

**Step 1: Create plugin.ts**

```typescript
import { registry } from '@/services/plugin-registry';
import { RedditPulsePanel } from './Panel';
import { handleRedditPulseRequest } from './route';

registry.register({
  id: 'reddit-pulse',
  name: 'RedditPulse',
  tab: 'news',
  refreshIntervalMs: 180_000,
  dataSource: 'api',
  routePath: '/api/reddit-pulse',
  panel: new RedditPulsePanel(),
  routeHandler: handleRedditPulseRequest,
});
```

**Step 2: Move and rename panel, service, route files**

- Copy `src/components/RedditPulsePanel.ts` → `src/plugins/RedditPulsePlugin/Panel.ts`
- Copy `src/services/reddit-pulse.ts` → `src/plugins/RedditPulsePlugin/service.ts`
- Copy `server/routes/reddit-pulse.ts` → `src/plugins/RedditPulsePlugin/route.ts`

Update internal imports in each file:
- `Panel.ts`: import Panel from `@/components/Panel`, import service from `./service`
- `service.ts`: import circuit-breaker from `@/utils/circuit-breaker`
- `route.ts`: import utils from `../../utils/sentiment-analyzer`

**Step 3: Update main.ts — add plugin import**

Add at top of imports: `import '@/plugins/RedditPulsePlugin/plugin';`

Remove from main.ts:
- `RedditPulsePanel` import from `'./components'`
- `const redditPulsePanel = new RedditPulsePanel();`
- `'reddit-pulse': redditPulsePanel` from PANEL_BY_ID
- `'reddit-pulse'` from DEFAULT_TAB_PANELS news tab
- `{ name: 'reddit-pulse', ... }` from scheduler
- `'reddit-pulse'` from refresh-all list
- RedditPulse command entry

**Step 4: Update vite-api-plugin.ts**

Remove `import { handleRedditPulseRequest } from './server/routes/reddit-pulse';`
Remove `'/api/reddit-pulse': handleRedditPulseRequest,` from routes object

Add registry-based route loader at the bottom of the routes object (or replace the entire object):

```typescript
import { registry } from './src/services/plugin-registry';

// Merge registry routes with manual ones
const registryRoutes = registry.getRouteMap().routes;
Object.assign(routes, registryRoutes);
```

**Step 5: Update server/index.ts** — same changes for Express.

**Step 6: Update barrel exports**

Remove from `src/components/index.ts`: `export { RedditPulsePanel } from './RedditPulsePanel';`
Remove from `src/services/index.ts`: reddit-pulse re-exports

**Step 7: Delete old files**

Delete: `src/components/RedditPulsePanel.ts`, `src/services/reddit-pulse.ts`, `server/routes/reddit-pulse.ts`

**Step 8: Verify**

Run: `npm run type:check && npm run lint`
Expected: 0 errors

---

### Task 2: Migrate TruthWatchPlugin

**Files:**
- Create: `src/plugins/TruthWatchPlugin/plugin.ts`
- Create: `src/plugins/TruthWatchPlugin/Panel.ts`
- Create: `src/plugins/TruthWatchPlugin/service.ts`
- Create: `src/plugins/TruthWatchPlugin/route.ts`
- Delete/move: old scattershot files (same pattern as Task 1)

Same steps as Task 1, substituting TruthWatch.

---

### Task 3: Migrate XWatchPlugin

**Files:**
- Create: `src/plugins/XWatchPlugin/plugin.ts`
- Create: `src/plugins/XWatchPlugin/Panel.ts`
- Create: `src/plugins/XWatchPlugin/service.ts`
- Create: `src/plugins/XWatchPlugin/route.ts`
- Delete/move: old scattershot files

Same steps as Task 1, substituting XWatch.

---

### Task 4: Clean up registration in main.ts + route files

**Step 1: Replace manual route list in vite-api-plugin.ts with registry loader**

```typescript
import { registry } from './src/services/plugin-registry';

type RouteHandler = (
  query: Record<string, string>,
  body: string,
  headers: Record<string, string | string[] | undefined>
) => Promise<unknown>;

const manualRoutes: Record<string, RouteHandler> = {
  '/api/stocks': handleStockRequest,
  '/api/chart': handleChartRequest,
  '/api/symbols/search': handleSymbolSearch,
  // ... keep remaining non-plugin routes
};

const registryRoutes = registry.getRouteMap().routes;
const routes = { ...manualRoutes, ...registryRoutes };
```

**Step 2: Same for server/index.ts**

**Step 3: Wire registry.bootstrap() into main.ts**

```typescript
import { registry } from '@/services/plugin-registry';
import '@/plugins/RedditPulsePlugin/plugin';
import '@/plugins/TruthWatchPlugin/plugin';
import '@/plugins/XWatchPlugin/plugin';

const { tabPanels, allPanels, refreshTasks, commands } = registry.bootstrap(getPreferences());
scheduler.registerAll(refreshTasks);
registerCommands(commands);
// ... mount panels into grids
```

**Step 4: Update SettingsModal to use registry.getPanelDefs()**

Replace the hardcoded `TAB_PANEL_DEFS` with:
```typescript
const TAB_PANEL_DEFS = registry.getPanelDefs();
```

**Step 5: Final verification**

Run: `npm run type:check && npm run lint`
Expected: 0 errors

---

## Verification

After all tasks:
```bash
npm run type:check
npm run lint
npx prettier --check "src/**/*.ts" "server/**/*.ts"
```

Also manually test:
- RedditPulse, TruthWatch, XWatch panels still render in News tab
- Refresh scheduler ticks them every 3 min
- SettingsModal shows visibility toggles for all 3
- Command palette "RedditPulse" / "TruthWatch" / "XWatch" entries work
- `/api/reddit-pulse`, `/api/truthwatch`, `/api/xwatch` routes respond
