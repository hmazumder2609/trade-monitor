# Visual Facelift Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Fix 5 visual/layout issues: panels not filling grid, alerts in sidebar instead of app bar, transparent settings popover, oversized settings modal, undefined CSS variable.

**Architecture:** CSS grid changes + DOM restructuring (alerts sidebar → app bar) + CSS variable fixes + modal sizing. No new files created; all changes in existing CSS/TS/HTML.

**Tech Stack:** Vanilla TS, CSS custom properties, DOM manipulation.

---

### Task 1: Fix CSS Grid Layout + Define --bg-elevated

**Files:**
- Modify: `src/styles/main.css:253-264` (panels-grid)
- Modify: `src/styles/main.css:1-64` (add --bg-elevated to :root)

**Step 1: Add --bg-elevated to both themes**

In `:root` (dark mode), after `--surface-active`:
```css
--bg-elevated: #1a1a1a;
```

In `:root[data-theme="light"]:not([data-variant="happy"])`, after `--surface-active`:
```css
--bg-elevated: #ffffff;
```

**Step 2: Fix panels-grid to fill viewport**

Replace the `.panels-grid` block (lines 253-264):
```css
.panels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-flow: row dense;
  grid-auto-rows: minmax(250px, 1fr);
  gap: 6px;
  padding: 6px;
  align-content: stretch;
  align-items: stretch;
  min-height: 0;
  height: 100%;
  position: relative;
}
```

Key changes: `grid-auto-rows` max removed (was 360px), `align-content: stretch`, `height: 100%`.

**Step 3: Fix responsive breakpoints**

In `@media (max-width: 768px)` (line 4409), change `grid-auto-rows`:
```css
grid-auto-rows: minmax(180px, auto);
```

In `@media (min-width: 1600px)` (line 4420), keep existing `minmax(320px, 1fr)`.

**Step 4: Verify**

Run: `npx tsc --noEmit` (no TS changes, just CSS)
Run: `npx vitest run` (all tests should pass)
Visually: panels should fill the viewport height without wasted space at bottom.

---

### Task 2: Remove Excessive Panel Spans

**Files:**
- Modify: `src/plugins/WeatherPlugin/Panel.ts:80` — remove `className: 'span-2'`
- Modify: `src/plugins/WorldClockPlugin/Panel.ts:74` — remove `className: 'span-2'`
- Modify: `src/plugins/SchedulePlugin/plugin.ts` — remove span-2 from SchedulePanel
- Modify: `src/plugins/StrategyJournalPlugin/Panel.ts:26` — remove `className: 'span-2'`
- Modify: `src/plugins/TradeReviewPlugin/Panel.ts` — remove span-2
- Modify: `src/plugins/PlaybookManagerPlugin/Panel.ts:26` — remove `className: 'span-2'`
- Modify: `src/plugins/BacktestLogPlugin/Panel.ts:22` — remove `className: 'span-2'`
- Modify: `src/plugins/HabitTrackerPlugin/Panel.ts:26` — remove `className: 'span-2'`
- Modify: `src/plugins/HealthMetricsPlugin/Panel.ts:48` — remove `className: 'span-2'`
- Modify: `src/plugins/RoutineSchedulerPlugin/Panel.ts` — remove span-2
- Modify: `src/plugins/MentalCheckInPlugin/Panel.ts:22` — remove `className: 'span-2'`
- Modify: `src/plugins/StockPlugin/Panel.ts:63` — change from `className: 'panel-wide span-2'` to `className: ''`
- Modify: `src/plugins/YieldCurvePlugin/Panel.ts:26` — remove `className: 'panel-wide'`
- Modify: `src/plugins/CentralBankTrackerPlugin/Panel.ts:23` — remove `className: 'panel-wide'`
- Modify: `src/plugins/OnChainPlugin/Panel.ts:45` — remove `className: 'panel-wide'`
- Modify: `src/plugins/SocialMonitorPlugin/Panel.ts:60` — remove `className: 'panel-wide'`

**Keep span-2/panel-wide on:**
- MapPlugin (panel-wide span-2) — map genuinely needs 2×2
- InsightsPlugin (panel-wide span-2) — AI summary needs 2×2
- DevOpsPlugin (panel-wide) — process monitor needs width
- FinancialNewsPlugin (panel-wide) — news list needs width
- LiveNewsPlugin (panel-wide) — video needs width
- TradingPlugin (panel-wide) — chart needs width
- PortfolioPlugin (panel-wide) — portfolio needs width
- OptionsFlowPlugin — keep as-is

**Step 1: Remove span-2 from each file**

For each file listed above, change `className: 'span-2'` to `className: ''` or remove the className property entirely.

**Step 2: Remove panel-wide from macro/onchain/social-monitor**

For yield-curve, central-bank-tracker, onchain, social-monitor: change `className: 'panel-wide'` to `className: ''`.

**Step 3: Verify**

Run: `npm run type:check`
Run: `npm run test`
Visually: each tab should have uniform 1×1 panels (except map and insights on Dashboard).

---

### Task 3: Move Alerts from Sidebar to App Bar

**Files:**
- Modify: `index.html:49-50` — remove sidebarMount div
- Modify: `src/main.ts:10-11,78-79` — remove sidebar import and mount
- Modify: `src/styles/main.css:2614-2625` — remove sidebar from app-body
- Modify: `src/styles/main.css:2468-2560` — remove sidebar CSS (or repurpose)
- Modify: `src/components/TodayFocusSidebar.ts` — rewrite to render in app bar

**Step 1: Add alerts button to app bar**

In `index.html`, add before the settings button in `.app-header-right`:
```html
<button class="settings-btn alerts-btn" id="alertsBtn" title="Alerts">
  <span class="alerts-icon">🔔</span>
  <span class="alerts-badge" id="alertsBadge" style="display:none">0</span>
</button>
```

**Step 2: Add alerts dropdown CSS**

In `main.css`, add after `.settings-btn` styles:
```css
.alerts-btn { position: relative; }
.alerts-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--red);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.alerts-dropdown {
  position: fixed;
  z-index: 10001;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 12px;
  min-width: 320px;
  max-width: 400px;
  max-height: 60vh;
  overflow-y: auto;
  animation: popover-in 0.12s ease-out;
}
```

**Step 3: Rewrite TodayFocusSidebar to render in dropdown**

Change `createTodayFocusSidebar()` to instead create a dropdown element appended to the alerts button. Export `addFocusAlert` (already exported). The dropdown renders alert items.

**Step 4: Remove sidebar from layout**

In `index.html`, remove `<div id="sidebarMount"></div>`.
In `main.ts`, remove `sidebarMount` lines and `createTodayFocusSidebar` import.
In `main.css`, remove `.today-focus-sidebar` styles and the `app-body > .sidebar` flex rules.

**Step 5: Wire alerts button click**

In `main.ts`, add click handler for `#alertsBtn` that toggles the alerts dropdown.

**Step 6: Verify**

Run: `npm run type:check`
Run: `npm run test`
Visually: no sidebar on left, alerts accessible via bell icon in app bar.

---

### Task 4: Fix Panel Settings Popover Background

**Files:**
- Modify: `src/styles/main.css:583-596` — panel-settings-popover

**Step 1: Change background to use --surface**

Replace `background: var(--bg-elevated);` with `background: var(--surface);` in `.panel-settings-popover`. This is more reliable since `--surface` is always defined and opaque.

Actually, since we defined `--bg-elevated` in Task 1, this should already work. But let's verify and also add a fallback:
```css
.panel-settings-popover {
  background: var(--bg-elevated, var(--surface));
  ...
}
```

**Step 2: Verify**

Run: `npm run type:check`
Visually: settings popover should have solid opaque background matching panel color.

---

### Task 5: Trim and Resize Global Settings Modal

**Files:**
- Modify: `src/styles/main.css:2153-2163` — .modal sizing
- Modify: `src/components/SettingsModal.ts:441-488` — renderDataSourcesTab

**Step 1: Reduce modal size**

Replace `.modal` CSS:
```css
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: min(520px, 90vw);
  max-height: min(75vh, 600px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}
```

Key changes: removed `max-width: 640px`, use `width: min(520px, 90vw)`, changed `max-height` to `min(75vh, 600px)`.

**Step 2: Trim Data Sources tab**

In `renderDataSourcesTab`, remove the Feishu and GitHub Repos sections (they're niche). Keep: Stock Watchlist, News, AI toggle.

**Step 3: Verify**

Run: `npm run type:check`
Run: `npm run test`
Visually: settings modal should be narrower and not oversized.

---

### Task 6: Quality Gate

**Step 1: Type check**
Run: `npm run type:check`
Expected: no errors

**Step 2: Lint**
Run: `npm run lint`
Expected: no errors

**Step 3: Tests**
Run: `npm run test`
Expected: all tests pass

**Step 4: Format**
Run: `npm run format:check`
Expected: no formatting issues
