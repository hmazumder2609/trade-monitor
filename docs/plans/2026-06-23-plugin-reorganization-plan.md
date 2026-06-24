# Plugin Reorganization + VIX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Restructure 35 plugins into 7 coherent tabs, fix 7 orphaned plugins, add VIX volatility monitoring (dashboard gauge + full trading panel), merge LiveNews into FinancialNews, and apply responsive grid / semantic color polish.

**Architecture:** Plugin system with self-registration via `registry.register()` in `src/plugins/*/plugin.ts` and side-effect imports in `src/main.ts:16-46`. Tab layout configured via `DEFAULT_TAB_PANELS` in `src/main.ts:89-106`. Server routes in `server/routes/` and wired in both `vite-api-plugin.ts` (dev) and `server/index.ts` (prod).

**Tech Stack:** Vanilla TS + Vite (client), Express (server), Finnhub API via existing `/api/stocks` route. No new server routes needed for VIX.

**Files Touched Summary:**
- Modify: `src/main.ts` (imports, DEFAULT_TAB_PANELS)
- Modify: `src/plugins/RedditPulsePlugin/plugin.ts` (tab ID)
- Modify: `src/plugins/TruthWatchPlugin/plugin.ts` (tab ID)
- Modify: `src/plugins/XWatchPlugin/plugin.ts` (tab ID)
- Modify: `src/plugins/HabitTrackerPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/HealthMetricsPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/RoutineSchedulerPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/MentalCheckInPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/StrategyJournalPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/TradeReviewPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/PlaybookManagerPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/BacktestLogPlugin/plugin.ts` (refresh)
- Modify: `src/plugins/FinancialNewsPlugin/Panel.ts` (merge LiveNews)
- Delete: `src/plugins/LiveNewsPlugin/` (merged)
- Modify: `src/plugins/MapPlugin/Panel.ts` (absorb map glue from main.ts)
- Create: `src/plugins/VolatilityIndexPlugin/plugin.ts`
- Create: `src/plugins/VolatilityIndexPlugin/Panel.ts`
- Modify: `src/config/settings-keys.ts` (if VIX needs config)
- Modify: `src/main.ts` (remove map glue code)
- Modify: `src/styles/main.css` (responsive grid rules, VIX gauge styles)

---

## Task 1: Fix Orphaned Plugin Imports (DevOps)

**Files:**
- Modify: `src/main.ts:16-46` (add 4 missing side-effect imports)

**Step 1: Add 4 import lines to `src/main.ts`**

Insert these after line 46 (the last existing plugin import):

```typescript
import '@/plugins/DevOpsPlugin/plugin';
import '@/plugins/CodeStatusPlugin/plugin';
import '@/plugins/FeishuPlugin/plugin';
import '@/plugins/SystemMonitorPlugin/plugin';
```

**Step 2: Rename FeishuPlugin directory (import path fix)**

Current directory: `src/plugins/FeishuPlugin/`
The import in main.ts uses `FeishuPlugin` — but read the plugin.ts to confirm `FeishuPlugin/plugin` resolves. If the directory is named `FeishuPlugin`, the import `@/plugins/FeishuPlugin/plugin` works. No rename needed.

**Step 3: Verify no errors**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "fix: add missing devops plugin side-effect imports to main.ts"
```

---

## Task 2: Fix Orphaned Plugin Tab IDs (News)

**Files:**
- Modify: `src/plugins/RedditPulsePlugin/plugin.ts:7`
- Modify: `src/plugins/TruthWatchPlugin/plugin.ts:7`
- Modify: `src/plugins/XWatchPlugin/plugin.ts:7`

**Step 1: Change tab from `'news'` to `'financial-news'` in each plugin.ts**

In each file, change line `tab: 'news',` to:

```typescript
  tab: 'financial-news' as const,
```

Note the `as const` assertion to match the `TabId` type.

**Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/RedditPulsePlugin/plugin.ts src/plugins/TruthWatchPlugin/plugin.ts src/plugins/XWatchPlugin/plugin.ts
git commit -m "fix: set correct tab ID for RedditPulse/TruthWatch/XWatch plugins"
```

---

## Task 3: Create Personal Tab + Move Lifestyle Plugins

**Files:**
- Modify: `src/main.ts:89-106` (DEFAULT_TAB_PANELS)

**Step 1: Add Personal tab to `TAB_NAME_TO_ID`**

Replace:

```typescript
const TAB_NAME_TO_ID: Record<string, string> = {
  Dashboard: 'dashboard',
  Macro: 'macro',
  News: 'financial-news',
  Trading: 'trading',
  Strategy: 'strategy',
  Habits: 'habits',
  DevOps: 'devops',
};
```

Add `Personal: 'personal'` to the map.

**Step 2: Update `DEFAULT_TAB_PANELS`**

- Remove `weather`, `world-clock`, `quick-links` from `dashboard` array
- Add new `personal` entry:

```typescript
  personal: ['habit-tracker', 'health-metrics', 'routine-scheduler', 'mental-checkin', 'weather', 'world-clock', 'quick-links'],
```

- Remove `habit-tracker`, `health-metrics`, `routine-scheduler`, `mental-checkin` from the `habits` entry (since `habits` key is now gone from TAB_NAME_TO_ID... wait, no — `Habits: 'habits'` still exists in TAB_NAME_TO_ID, so `habits` tab content still exists).

Actually, let me rethink. The old layout is:
- `habits` tab: habit-tracker, health-metrics, routine-scheduler, mental-checkin
- New layout: `personal` tab gets all of these + weather + world-clock + quick-links

So we need to:
1. Remove `habits` from TAB_NAME_TO_ID (or keep it, but it would be empty — better to remove)
2. Remove `habits` entry from DEFAULT_TAB_PANELS
3. Add `personal` entry as above
4. Remove `weather`, `world-clock`, `quick-links` from `dashboard`

**Step 3: Update tab switching**

The HTML has tab buttons with `data-tab` attributes and tab contents with `data-tab-content` attributes. Need to make sure the HTML has a Personal tab button and content area. Check `index.html` for the existing tab structure.

Read `index.html` to find the tab button markup and add a Personal tab.

**Step 4: Update type**

If `TabId` (from `plugin-registry.ts:4`) doesn't include `'personal'`, add it:

```typescript
export type TabId = 'dashboard' | 'macro' | 'news' | 'trading' | 'strategy' | 'habits' | 'devops' | 'personal';
```

Remove `'habits'` or keep it (it's referenced by existing plugin registrations that need updating). The 4 habit plugins register with `tab: 'habits'` — they need to change to `tab: 'personal'`.

Wait, this is getting complex. Let me reconsider.

The 4 habit plugins register with `tab: 'habits'`. If I remove the `habits` tab, those plugins won't render. So I need to change their tab to `'personal'` too.

Alternatively, I could keep `'habits'` in the TabId type and have the personal tab use a different key. But that defeats the purpose.

Better approach:
1. Change TabId to include `'personal'`
2. Change 4 habit plugin registrations from `tab: 'habits'` → `tab: 'personal'`
3. Update `TAB_NAME_TO_ID` to replace `Habits: 'habits'` → `Personal: 'personal'`
4. Update `DEFAULT_TAB_PANELS` to use `'personal'` instead of `'habits'`
5. Remove `weather`, `world-clock`, `quick-links` from `dashboard`
6. Add them to `personal`
7. Update `index.html` tab button and content section

**Step 5: Verify**

Run: `npx tsc --noEmit` — must PASS

**Step 6: Commit**

```bash
git add src/main.ts src/plugins/HabitTrackerPlugin/plugin.ts src/plugins/HealthMetricsPlugin/plugin.ts src/plugins/RoutineSchedulerPlugin/plugin.ts src/plugins/MentalCheckInPlugin/plugin.ts src/services/plugin-registry.ts
git commit -m "feat: create Personal tab, move lifestyle plugins from Dashboard/Habits"
```

---

## Task 4: Normalize Refresh Intervals for Local-Only Panels

**Files:**
- Modify: `src/plugins/HabitTrackerPlugin/plugin.ts:8`
- Modify: `src/plugins/HealthMetricsPlugin/plugin.ts:8`
- Modify: `src/plugins/RoutineSchedulerPlugin/plugin.ts:8`
- Modify: `src/plugins/MentalCheckInPlugin/plugin.ts:8`
- Modify: `src/plugins/StrategyJournalPlugin/plugin.ts:8`
- Modify: `src/plugins/TradeReviewPlugin/plugin.ts:8`
- Modify: `src/plugins/PlaybookManagerPlugin/plugin.ts:8`
- Modify: `src/plugins/BacktestLogPlugin/plugin.ts:8`

**Step 1: Change refreshIntervalMs in each file**

For habit/health/routine/mental plugins: `refreshIntervalMs: 30_000` → `refreshIntervalMs: 5 * 60_000`
For strategy/trade/playbook/backtest plugins: `refreshIntervalMs: 60_000` → `refreshIntervalMs: 5 * 60_000`

**Step 2: Verify**

Run: `npx tsc --noEmit` → PASS

**Step 3: Commit**

```bash
git add src/plugins/HabitTrackerPlugin/plugin.ts src/plugins/HealthMetricsPlugin/plugin.ts src/plugins/RoutineSchedulerPlugin/plugin.ts src/plugins/MentalCheckInPlugin/plugin.ts src/plugins/StrategyJournalPlugin/plugin.ts src/plugins/TradeReviewPlugin/plugin.ts src/plugins/PlaybookManagerPlugin/plugin.ts src/plugins/BacktestLogPlugin/plugin.ts
git commit -m "perf: reduce refresh rate on local-only panels from 30-60s to 5min"
```

---

## Task 5: Merge LiveNews into FinancialNews

**Files:**
- Modify: `src/plugins/FinancialNewsPlugin/Panel.ts` (add RSS tab view)
- Delete: `src/plugins/LiveNewsPlugin/` (entire directory)
- Modify: `src/main.ts:40` (remove LiveNewsPlugin import)

**Step 1: Read both Panel.ts files**

Read `src/plugins/FinancialNewsPlugin/Panel.ts` and `src/plugins/LiveNewsPlugin/Panel.ts` to understand their rendering code. The goal is to combine both views into one panel with tabbed sub-sections.

**Step 2: Modify FinancialNewsPanel**

Add an internal tab toggle in the panel render:
- Tab 1: "Headlines" (existing NewsAPI content)
- Tab 2: "RSS Feeds" (LiveNews content)

Both data-sets load on refresh, stored in separate instance properties. The tab toggle switches which is visible in the DOM.

**Step 3: Remove LiveNewsPlugin**

Delete the directory: `rm -rf src/plugins/LiveNewsPlugin/`

**Step 4: Remove import from main.ts**

Remove line 40: `import '@/plugins/LiveNewsPlugin/plugin';`

**Step 5: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run test` → PASS (no regressions)

**Step 6: Commit**

```bash
git add src/plugins/FinancialNewsPlugin/Panel.ts src/main.ts
git rm -r src/plugins/LiveNewsPlugin/
git commit -m "refactor: merge LiveNews into FinancialNewsPanel as RSS tab"
```

---

## Task 6: Extract Map Glue from main.ts into MapPlugin

**Files:**
- Modify: `src/plugins/MapPlugin/Panel.ts` (absorb glue code)
- Modify: `src/main.ts` (remove lines 733-877, replace with single call)

**Step 1: Read current code**

Read `src/plugins/MapPlugin/Panel.ts` — understand the existing Panel class.

Read `src/main.ts:733-877` — the `refreshMapMarkers()`, `SOURCE_COORDS`, and `geolocateUrl()` code.

**Step 2: Move to MapPanel**

Add `refreshMapMarkers()` and `SOURCE_COORDS` and `geolocateUrl()` as private methods/constants inside `MapPanel` or as module-level exports in `Panel.ts`. The map plugin already has `addMarker` and `setMarkers` methods per the code in main.ts.

**Step 3: Update main.ts**

Replace the block `src/main.ts:733-877` with a call to the panel:

```typescript
// Map markers now handled inside MapPlugin
const mapPanel = PANEL_BY_ID['map'];
if (mapPanel && 'startAutoRefresh' in mapPanel) {
  (mapPanel as any).startAutoRefresh?.();
}
```

**Step 4: Update refresh scheduler reference**

In `scheduler.registerAll()`, the `map-data` task at line 347 currently calls `refreshMapMarkers`. Change to call the panel method:

```typescript
{ name: 'map-data', fn: () => PANEL_BY_ID['map']?.refresh() || Promise.resolve(), intervalMs: 10 * 60_000 },
```

**Step 5: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run test` → PASS

**Step 6: Commit**

```bash
git add src/plugins/MapPlugin/Panel.ts src/main.ts
git commit -m "refactor: move map marker logic from main.ts into MapPlugin"
```

---

## Task 7: Build VIX Dashboard Gauge

**Files:**
- Create: `src/plugins/VolatilityIndexPlugin/Gauge.ts` (compact gauge component)
- Create: `src/plugins/VolatilityIndexPlugin/plugin.ts` (registration)
- Create: `src/plugins/VolatilityIndexPlugin/Panel.ts` (Dashboard gauge panel)
- Modify: `src/main.ts` (add import for new plugin)
- Modify: `src/main.ts:89-106` (add to dashboard tab)
- Modify: `src/services/plugin-registry.ts` (if TabId needs update)

**Step 1: Create plugin registration**

`src/plugins/VolatilityIndexPlugin/plugin.ts`:

```typescript
import { registry } from '@/services/plugin-registry';
import { VixGaugePanel } from './Panel';

registry.register({
  id: 'vix-gauge',
  name: 'VIX Fear Gauge',
  tab: 'dashboard' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new VixGaugePanel(),
});
```

**Step 2: Create VIX gauge panel**

`src/plugins/VolatilityIndexPlugin/Panel.ts` — extend Panel class from `src/components/Panel.ts`.

Panel structure:
- Shows current VIX level in large text, color-coded (green <15, yellow 15-25, red >25)
- Shows 1d change (↑/↓ + value)
- Fetches from `/api/stocks?symbol=CBOE:VIX`

Key methods:
- `async refresh()` → fetches VIX quote, updates DOM
- `getSettingsPopover()` → returns settings popover (or null)
- `setMode(mode)` → no visual change for gauge (always compact)

**Step 3: Add import to main.ts**

Add line after existing plugin imports (around line 46):

```typescript
import '@/plugins/VolatilityIndexPlugin/plugin';
```

**Step 4: Add to dashboard DEFAULT_TAB_PANELS**

```typescript
dashboard: ['map', 'vix-gauge', 'insights', 'schedule', 'email', 'social'],
```

Place after `'map'` for prominence.

**Step 5: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run test` → PASS

**Step 6: Commit**

```bash
git add src/plugins/VolatilityIndexPlugin/ src/main.ts
git commit -m "feat: add VIX fear gauge to Dashboard tab"
```

---

## Task 8: Build VIX Full Panel (Trading Tab)

**Files:**
- Create: `src/plugins/VolatilityIndexPlugin/Panel.ts` (already exists from Task 7 — do this check)

Wait — the gauge and the full panel are different. Options:
A) One plugin with two rendering modes (dashboard gauge = compact, trading = full)
B) Two separate plugins sharing a VIX data service

Option A is simpler. Use the existing `setMode()` approach — when in the dashboard, show compact; when in trading tab, show full with chart.

But plugins are tied to a single tab in `registry.register()`. So we can't have one plugin in two tabs.

Option C: One VIX data utility class, two plugins (VIX Gauge on dashboard, VIX Index on trading).

Go with Option C — two plugin registrations sharing a common `fetchVixData()` utility.

**Step 1: Create VIX data service**

`src/plugins/VolatilityIndexPlugin/vix-data.ts`:

```typescript
export interface VixSnapshot {
  price: number;
  change: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  timestamp: string;
}

export async function fetchVixSnapshot(): Promise<VixSnapshot> {
  const resp = await fetch('/api/stocks?symbol=CBOE:VIX');
  if (!resp.ok) throw new Error(`VIX fetch failed: ${resp.status}`);
  const data = await resp.json();
  // Transform Finnhub quote response into VixSnapshot
  return {
    price: data.c ?? 0,
    change: (data.c ?? 0) - (data.pc ?? 0),
    changePercent: ((data.c ?? 0) - (data.pc ?? 0)) / (data.pc ?? 1) * 100,
    high52w: data.h ?? 0,
    low52w: data.l ?? 0,
    timestamp: new Date().toISOString(),
  };
}
```

**Step 2: Create VolatilityIndexPanel**

`src/plugins/VolatilityIndexPlugin/Panel.ts` — full panel with:
- Current VIX level (large) + daily/weekly/monthly change
- Historical percentile (computed from fetched range)
- 52-week min/max range bar (visual bar with current position)
- Color coding matching the gauge

**Step 3: Create second plugin registration**

Modify `src/plugins/VolatilityIndexPlugin/plugin.ts` to register **two** plugins:

```typescript
import { registry } from '@/services/plugin-registry';
import { VixGaugePanel } from './Panel';
import { VolatilityIndexPanel } from './Panel';

registry.register({
  id: 'vix-gauge',
  name: 'VIX Fear Gauge',
  tab: 'dashboard' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new VixGaugePanel(),
});

registry.register({
  id: 'volatility-index',
  name: 'Volatility Index',
  tab: 'trading' as const,
  refreshIntervalMs: 5 * 60_000,
  dataSource: 'api' as const,
  panel: new VolatilityIndexPanel(),
});
```

**Step 4: Add to Trading tab DEFAULT_TAB_PANELS**

```typescript
trading: ['trading', 'stocks', 'finance', 'options-flow', 'onchain', 'volatility-index'],
```

**Step 5: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run test` → PASS

**Step 6: Commit**

```bash
git add src/plugins/VolatilityIndexPlugin/ src/main.ts
git commit -m "feat: add Volatility Index panel to Trading tab"
```

---

## Task 9: UI Polish — Responsive Grid + Stale Indicators + Semantic Colors

**Files:**
- Modify: `src/styles/main.css` (grid rules, stale indicator styles)
- Modify: `src/components/Panel.ts` (stale data indicator logic)

**Step 1: Ensure responsive grid**

The panel grid should use CSS Grid with:
```css
.panels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
```

`.panel-wide` should span 2 columns:
```css
.panel-wide {
  grid-column: span 2;
}
```

Desired breakpoints:
- ≥1200px: 3 columns
- 800–1199px: 2 columns
- <800px: 1 column

This should already work with `auto-fill` + `minmax` — verify and adjust `minmax` value.

**Step 2: Add stale data indicator**

In `Panel.ts`, track `lastRefreshTime`. If `(now - lastRefreshTime) > 2 * refreshInterval`, add `class="panel-stale"` to the panel element. CSS:

```css
.panel-stale {
  opacity: 0.6;
}
.panel-stale::after {
  content: 'stale';
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}
```

**Step 3: Verify semantic color consistency**

Check existing panel CSS files for color usage. The established semantic tokens (from theme-manager) should be used:

- `var(--positive)` / `var(--negative)` for price/status colors
- `var(--warning)` for yellow/amber states
- `var(--info)` for blue info
- `var(--text-muted)` for secondary data

These should already be in `src/styles/main.css` or `src/styles/happy-theme.css`. Verify and add any missing variables.

**Step 4: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run test` → PASS
Run: `npm run lint` → PASS

**Step 5: Commit**

```bash
git add src/styles/main.css src/components/Panel.ts
git commit -m "style: responsive grid layout, stale data indicator, semantic color tokens"
```

---

## Task 10: Update HTML Tab Buttons

**Files:**
- Modify: `index.html` (add Personal tab button + tab content section)

**Step 1: Read index.html**

Find the tab button navigation and tab content sections. Add:
- A `Personal` tab button with `data-tab="personal"`
- A tab content section with `data-tab-content="personal"` and `id="panelsGrid-personal"`

Also add the DevOps tab content section if it doesn't exist (since we're fixing the plugins that live there).

**Step 2: Verify**

Run: `npx tsc --noEmit` → PASS (no TS errors for HTML changes)

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Personal tab to HTML layout"
```

---

## Final Verification: Quality Gates

Run all checks together:

```bash
npm run type:check && npm run lint && npm run format:check && npm run test:coverage
```

Expected: All PASS. Coverage thresholds: lines/functions ≥50%, branches ≥40%.

If any fail, fix and amend the relevant commit.
