# Plugin Reorganization + VIX — Design

## Objective

Restructure trade-monitor's 35 plugins from a noisy flat layout into clean role-based tabs, fix 7 orphaned plugins, add VIX volatility monitoring, and consolidate overlapping panels — all while establishing a coherent UI/UX direction for the next development phase.

---

## 1. Tab Architecture

Seven tabs with clear role separation:

| # | Tab | Panels | Role |
|---|-----|--------|------|
| 1 | **Dashboard** | schedule, email, insights, social, map | Morning briefing — today's events, AI market summary, tech/community pulse, global context |
| 2 | **Macro** | macro-calendar, economic-indicators, central-bank-tracker, yield-curve | Pre-market macro scan (unchanged) |
| 3 | **News** | financial-news *(merged with live-news)*, social-sentiment, reddit-pulse, truth-watch, x-watch | All news sources + sentiment + source monitoring in one coherent view |
| 4 | **Trading** | stocks, trading, portfolio, options-flow, onchain, **volatility-index** | Live markets, positions, options, crypto, volatility |
| 5 | **Strategy** | strategy-journal, trade-review, playbook-manager, backtest-log | Post-market review (unchanged) |
| 6 | **Personal** | habit-tracker, health-metrics, routine-scheduler, mental-checkin, weather, world-clock, quick-links | Lifestyle — separated from financial views |
| 7 | **DevOps** | devops, code-status, feishu, system-monitor | Infrastructure monitoring |

---

## 2. Changes from Current State

### 2.1 Plugin Moves
- `weather`, `world-clock`, `quick-links` → Dashboard → Personal
- `reddit-pulse`, `truth-watch`, `x-watch` → tab `'news'` → `'financial-news'` (fix orphaned tab ID)
- `devops`, `code-status`, `feishu`, `system-monitor` → add missing side-effect imports in `main.ts` (fix unmounted)

### 2.2 Consolidations
- **LiveNews → FinancialNews**: Merge into one `FinancialNewsPanel` with two tabbed views: "Headlines" (NewsAPI) / "RSS Feeds" (LiveNews sources). Removes standalone `LiveNewsPlugin` directory.
- **No other panels deleted** — all existing functionality preserved.

### 2.3 Refresh Normalization
| Panel(s) | Current | New | Rationale |
|----------|---------|-----|-----------|
| habit-tracker, health-metrics, routine-scheduler, mental-checkin | 30s | 5min | Local-only data |
| strategy-journal, trade-review, playbook-manager, backtest-log | 60s | 5min | Local-only data |
| reddit-pulse, truth-watch, x-watch | 3min | 3min | Keep (API-dependent, reasonable) |
| volatility-index | n/a | 5min | VIX updates slowly |

### 2.4 Map Glue Extraction
Move `refreshMapMarkers()` function + `SOURCE_COORDS` constant + `geolocateUrl()` from `main.ts:733-877` into `MapPlugin/Panel.ts`. The map panel should own its data-fetching logic.

---

## 3. VIX (Volatility Index) — Two-Part Implementation

### 3.1 Dashboard Gauge
- **What**: Compact stat card in Dashboard grid (adjacent to schedule/insights)
- **Display**: Current VIX level + color-coded state + 1d change
  - `< 15` → green (low volatility)
  - `15–25` → yellow (normal)
  - `> 25` → red (elevated fear)
- **Data**: Finnhub quote for `CBOE:VIX` via existing `/api/stocks` route
- **Refresh**: Every 5min (aligned with news/schedule)

### 3.2 Trading Tab Panel (volatility-index)
- **Display**:
  - VIX level + 1d/1w/1m change
  - VIX term structure chart (front-month vs next-month futures → contango/backwardation indicator)
  - Historical percentile rank (1y and 5y lookback)
  - 52-week min/max range bar
- **Data**: `/api/stocks` for current quote, `/api/chart` for historical VIX data
- **Tech note**: Finnhub already supports arbitrary symbols. No new server route needed.
- **Refresh**: Every 5min

---

## 4. UI/UX Direction

### 4.1 Core Principles
- **Role-based tabs** ensure the user sees the right information in context. Dashboard = today's briefing. Trading = live positions. Strategy = reflection.
- **Visual hierarchy**: Each panel within a tab is sized proportionally to its information density. Compact panels (VIX gauge, world clock) get smaller grid slots. Data-rich panels (markets, financial news) get larger slots.
- **Responsive grid**: Panel grid uses CSS grid with `auto-fit` + `minmax` to reflow from 3 columns (desktop) → 2 columns (tablet) → 1 column (mobile). Panels marked `.panel-wide` span 2 columns.

### 4.2 Color System
- **Dark theme default** with light theme toggle (already implemented via `theme-manager.ts`).
- **Semantic colors** (consistent across all panels):
  - Green: positive price action, low VIX, uptime OK
  - Red: negative price action, high VIX, alerts/critical
  - Yellow/amber: warning, moderate VIX, degraded service
  - Blue: neutral information, links, AI-generated content
  - Muted gray: secondary data, labels, timestamps
- **No more than 3 functional colors per panel** to avoid visual noise.

### 4.3 Realtime Feedback
- **WebSocket-based refresh** (future): Panels update via push rather than polling. Current RefreshScheduler polling approach is adequate for the initial reorganization but should be migrated to WebSocket for real-time panels (markets, VIX, trading) in a follow-up.
- **Subtle pulse indicator**: Each panel shows a small animated dot when refreshing. No full-page spinners.
- **Stale data indicator**: If a panel's data is older than 2× its refresh interval, show a dimmed state with "stale" badge instead of disappearing content.

### 4.4 Layout Mode
- `PanelMode` (`'monitoring' | 'research'`) already exists via Cmd/Ctrl+Shift+R.
- **Monitoring mode**: Compact panels, hides AI summary detail, emphasizes alert-style data (price moves, VIX spikes, breaking news).
- **Research mode**: Expanded panels, shows AI summaries, full chart views, historical context.
- Each new panel (VIX gauge, merged news) must implement `setMode()` accordingly.

---

## 5. Implementation Order

1. **Fix orphaned plugins** (4 devops imports + 3 news tab IDs) — 7 import/edit changes, no behavioral risk.
2. **Create Personal tab** — move weather, world-clock, quick-links to new tab in `DEFAULT_TAB_PANELS`.
3. **Adjust refresh intervals** — change 4 habit + 4 strategy panels from high-frequency to 5min.
4. **Merge LiveNews into FinancialNews** — rewrite FinancialNewsPanel to support tabbed "Headlines / RSS" view. Remove LiveNewsPlugin directory.
5. **Extract map glue** — move `refreshMapMarkers()` + `SOURCE_COORDS` into `MapPlugin/Panel.ts`.
6. **Build VIX dashboard gauge** — new compact stat card component, Finnhub data via existing route.
7. **Build VIX full panel** — new `VolatilityIndexPlugin` in Trading tab with term structure chart.
8. **UI polish** — apply responsive grid rules, semantic color scheme, stale-data indicators.

---

## 6. Testing Strategy

- **Existing Vitest suite** should all pass with no regressions (tab reorganization is purely config moves).
- **VIX panels**: Add server-side test for `CBOE:VIX` quote fetch in `tests/server.test.ts`. Add panel-level tests for display logic (color coding, percentile calculation) in `tests/utils.test.ts`.
- **Merged news panel**: Update existing `FinancialNewsPlugin` Panel class — no new test surface if behavior is preserved.
- **Manual verification**: Open all 7 tabs, confirm each panel mounts. Confirm DevOps tab renders for the first time.

---

## 7. Non-Goals (deferred)

- WebSocket migration for real-time push (future project)
- Removing `Social` plugin (dashboard) — kept for HN/tech community feed
- Full mobile-responsive PWA (responsive grid is sufficient for now)
