# Plugin Architecture Design

**Goal:** Encapsulate each of the 37 panels into self-contained plugin directories so they can be developed, iterated, and reasoned about independently.

**Architecture:** Each panel becomes a `src/plugins/<PluginName>/` directory owning its complete stack — panel class, service/types, and optionally a server route handler. A `PluginRegistry` singleton auto-wires everything: tab grids, refresh scheduler, API routes, command palette entries, and visibility toggles.

**End state:** `main.ts` shrinks from orchestrating 6 manual registration points to just `registry.bootstrap()`. `vite-api-plugin.ts` and `server/index.ts` become generic route loaders from the registry. Old `src/components/`, `src/services/`, `server/routes/` directories shrink as panels migrate.

---

## Plugin Directory Layout

```
src/plugins/StockPlugin/
  plugin.ts      — manifest + self-registration call
  Panel.ts       — panel class (moved from src/components/StockPanel.ts)
  service.ts     — types + circuit-broken fetcher (moved from src/services/stock-market.ts)
  route.ts       — server route handler (moved from server/routes/stock.ts) — OPTIONAL
```

**When `route.ts` exists:** The panel talks to an external API via a server-side proxy
**When `route.ts` is absent:** The panel uses IndexedDB, localStorage, or is static (no server needed)

## PluginManifest Interface

```typescript
interface PluginManifest {
  id: string;                       // 'stocks', 'email', 'habits', etc.
  name: string;                     // Display name
  tab: TabId;                       // Which tab this belongs to
  refreshIntervalMs?: number;       // Scheduler interval (omit = no auto-refresh)
  dataSource: 'api' | 'local' | 'static';
  routePath?: string;               // '/api/stocks' — only for api type
  panel: Panel;
  routeHandler?: RouteHandler;      // Server handler function
}
```

## PluginRegistration

Each `plugin.ts` calls:

```typescript
import { registry } from '@/services/plugin-registry';
import { StockPanel } from './Panel';
import { handleStockRequest } from './route';

registry.register({
  id: 'stocks',
  name: 'Stock Market',
  tab: 'trading',
  refreshIntervalMs: 60_000,
  dataSource: 'api',
  routePath: '/api/stocks',
  panel: new StockPanel(),
  routeHandler: handleStockRequest,
});
```

## PluginRegistry (client-side)

```typescript
class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();

  register(manifest: PluginManifest): void;

  getPanel(id: string): Panel | undefined;
  getAllPanels(): Panel[];
  getTabPanels(): Record<string, Panel[]>;       // built from manifest.tab
  getRefreshTasks(): RefreshRegistration[];       // built from manifest.refreshIntervalMs
  getCommandEntries(): CommandEntry[];             // built from all panels for cmd+palette
  getRouteMap(): { routes: Routes, prefixRoutes: PrefixRoutes };
  getPanelDefs(): Record<string, { id: string; label: string }[]>;  // for SettingsModal visibility
  bootstrap(): TabPanels;                          // returns all data structures at once
}
```

## What `main.ts` Becomes

```typescript
// Import all plugins (each self-registers on import)
import '@/plugins/StockPlugin/plugin';
import '@/plugins/TradingPlugin/plugin';
import '@/plugins/MapPlugin/plugin';
// ... 37 imports

const app = registry.bootstrap();
// app.tabPanels → mount grids
// app.allPanels → cleanup on unload
// app.refreshTasks → scheduler.registerAll()
// app.commandEntries → registerCommands()
// app.panelDefs → for SettingsModal
```

## What `vite-api-plugin.ts` + `server/index.ts` Become

```typescript
const { routes, prefixRoutes } = registry.getRouteMap();
// → feed into the existing middleware, no more per-route imports
```

Both files still exist, still handle middleware, CORS, error handling. They just load route handlers from the registry instead of importing 18 individual handlers.

## What SettingsModal Gets

`registry.getPanelDefs()` returns `TAB_PANEL_DEFS` — the same structure currently hardcoded. No more manual updates when adding a plugin.

## Migration Plan (Strangler Fig)

### Phase 0: Build Infrastructure
- Create `src/services/plugin-registry.ts` (~100 lines)
- Create `src/plugins/` directory
- Keep all existing code working — registry is additive

### Phase 1: Migrate the 3 Social Sentiment 2.0 Panels
- RedditPulse → `src/plugins/RedditPulsePlugin/`
- TruthWatch → `src/plugins/TruthWatchPlugin/`
- XWatch → `src/plugins/XWatchPlugin/`
- These are already the newest panels, least likely to break existing code

### Phase 2: Migrate Route-Backed Panels (12 panels)
- Stocks, Trading, News, Email, Schedule, Feishu, CodeStatus, Social, OptionsFlow, OnChain, Macro (consolidated), SystemMonitor

### Phase 3: Migrate Local-Backed Panels (8 panels)
- Strategy tab (4 panels) + Habits tab (4 panels) — IndexedDB via `idb-store.ts`

### Phase 4: Migrate Static/LocalStorage Panels (6 panels)
- Portfolio, Weather, Map, Flight, QuickLinks, WorldClock

### Phase 5: Consolidate
- Delete `src/components/` (all panel classes moved)
- Delete `src/services/` (all fetchers moved, keep plugin-registry.ts + shared stores)
- Delete `server/routes/` (all handlers moved)
- Remove all old registration code from `main.ts`, `vite-api-plugin.ts`, `server/index.ts`

## Plugin Count by Phase

| Phase | Panels | Data Source |
|-------|--------|-------------|
| 1 | 3 | API |
| 2 | 12 | API |
| 3 | 8 | IndexedDB |
| 4 | 6 | localStorage/static |
| Remaining core infrastructure (not plugins) | — | Panel.ts base, settings-store, idb-store, preferences, plugin-registry |

## Shared Dependencies Plugins Keep Using

- `Panel` base class (from `src/components/Panel.ts` — stays as shared dependency)
- `settings-store.ts` — for getSecret(), getPreferences()
- `idb-store.ts` — for IndexedDB wrappers
- `circuit-breaker.ts` — for API resilience
- `refresh-scheduler.ts` — managed by PluginRegistry
- `theme-manager.ts`, `utils/` — helpers

## Files Modified Per Phase

### Phase 0 (Infrastructure)
- **Create:** `src/services/plugin-registry.ts`
- **Create:** `src/plugins/` (directory)

### Phase 1 (First 3 plugins)
- **Create:** `src/plugins/RedditPulsePlugin/` (plugin.ts, Panel.ts, service.ts, route.ts)
- **Create:** `src/plugins/TruthWatchPlugin/` (same)
- **Create:** `src/plugins/XWatchPlugin/` (same)
- **Modify:** `main.ts` — add 3 plugin imports, remove old 6 registration spots
- **Modify:** `vite-api-plugin.ts` — remove 3 old imports and route entries, add registry loader
- **Modify:** `server/index.ts` — same
- **Modify:** `components/index.ts` — remove 3 old exports
- **Modify:** `services/index.ts` — remove 3 old exports
- **Modify:** `SettingsModal.ts` — use registry.getPanelDefs()
- **Delete:** `src/components/RedditPulsePanel.ts`
- **Delete:** `src/services/reddit-pulse.ts`
- **Delete:** `server/routes/reddit-pulse.ts`
- **Delete:** (same for TruthWatch and XWatch)

### Phases 2-5
- Repeat the pattern: move 3-12 panels at a time, remove old files, update registration

## Verification

After each phase:
```bash
npm run type:check && npm run lint
```
