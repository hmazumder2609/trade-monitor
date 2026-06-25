# Plugin Coherence Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Make the plugin ecosystem coherent for an expert financial analyst's daily workflow — eliminate redundancy, fix tab assignments, hide noise, and enable time-aware briefings.

**Architecture:** 7 focused tasks across DEFAULT_TAB_PANELS, plugin manifests, and panel classes. Each task is a single logical change with its own commit. No new API endpoints needed — all changes are client-side panel registration and rendering logic.

**Tech Stack:** Vanilla TypeScript, plugin registry pattern, Panel base class, DataLayer subscriptions.

---

## Task 1: Move weather + world-clock + quick-links to Dashboard

**Why:** These are ambient utility panels (time awareness, launcher) that belong on the Dashboard, not buried in Personal. Fixes the registry-tab vs DEFAULT_TAB_PANELS divergence bug.

**Files:**
- Modify: `src/main.ts:94-114` (DEFAULT_TAB_PANELS)
- Modify: `src/plugins/WeatherPlugin/plugin.ts:7` (tab: 'dashboard' → remove, already 'dashboard')
- Modify: `src/plugins/WorldClockPlugin/plugin.ts:7` (tab: 'dashboard' → remove, already 'dashboard')
- Modify: `src/plugins/QuickLinksPlugin/plugin.ts` (tab: 'dashboard' → remove, already 'dashboard')

**Step 1: Update DEFAULT_TAB_PANELS in main.ts**

Move `weather`, `world-clock`, `quick-links` from the `personal` array to the `dashboard` array. The plugin manifests already declare `tab: 'dashboard'`, so this aligns the runtime layout with the registry.

```ts
// BEFORE (main.ts:94-114)
const DEFAULT_TAB_PANELS: Record<string, string[]> = {
  dashboard: ['vix-gauge', 'map', 'insights', 'schedule', 'email', 'social'],
  macro: ['macro-calendar', 'economic-indicators', 'central-bank-tracker', 'yield-curve'],
  'financial-news': [
    'financial-news',
    'live-news',
    'social-sentiment',
    'reddit-pulse',
    'truth-watch',
    'x-watch',
  ],
  trading: ['trading', 'stocks', 'finance', 'options-flow', 'onchain', 'volatility-index'],
  strategy: ['strategy-journal', 'trade-review', 'playbook-manager', 'backtest-log'],
  personal: [
    'habit-tracker',
    'health-metrics',
    'routine-scheduler',
    'mental-checkin',
    'weather',
    'world-clock',
    'quick-links',
  ],
  devops: ['devops', 'code-status', 'feishu', 'system-monitor'],
};

// AFTER
const DEFAULT_TAB_PANELS: Record<string, string[]> = {
  dashboard: ['vix-gauge', 'weather', 'world-clock', 'quick-links', 'map', 'insights', 'schedule', 'email'],
  macro: ['macro-calendar', 'economic-indicators', 'central-bank-tracker', 'yield-curve'],
  'financial-news': [
    'financial-news',
    'live-news',
    'social-sentiment',
    'reddit-pulse',
    'truth-watch',
    'x-watch',
  ],
  trading: ['trading', 'stocks', 'finance', 'options-flow', 'onchain', 'volatility-index'],
  strategy: ['strategy-journal', 'trade-review', 'playbook-manager', 'backtest-log'],
  personal: [
    'habit-tracker',
    'health-metrics',
    'routine-scheduler',
    'mental-checkin',
  ],
  devops: ['devops', 'code-status', 'feishu', 'system-monitor'],
};
```

**Step 2: Verify plugin manifests are correct**

Weather, WorldClock, and QuickLinks already declare `tab: 'dashboard'` in their plugin.ts files. No changes needed to manifests — they're already correct.

**Step 3: Verify build**

Run: `npm run type:check && npm run lint && npm run test`
Expected: All pass (no type errors, no new lint errors, 63/63 tests pass)

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "fix: move weather, world-clock, quick-links to Dashboard tab"
```

---

## Task 2: Merge reddit-pulse + truth-watch + x-watch into Social Monitor

**Why:** 3 separate social monitoring panels create cognitive overload. An expert checking "what's the buzz" should see one unified view with platform tabs, not 3 separate feeds.

**Approach:** Create a new `SocialMonitorPlugin` that combines all three platforms into one panel with internal tabs (All / Reddit / Truth Social / X). Follow the SocialPlugin (Tech Community) multi-platform tab pattern. The existing 3 plugins remain installed but hidden by default.

**Files:**
- Create: `src/plugins/SocialMonitorPlugin/Panel.ts`
- Create: `src/plugins/SocialMonitorPlugin/plugin.ts`
- Modify: `src/main.ts:16-50` (add import)
- Modify: `src/main.ts:97-104` (update DEFAULT_TAB_PANELS for news tab)

**Step 1: Create SocialMonitorPlugin/Panel.ts**

This panel fetches data from all three platforms in parallel, stores them in memory, and provides platform-filtered tabs.

```ts
import { Panel } from '@/components/Panel';
import {
  dataLayer,
  REDDIT_PULSE_SOURCE_ID,
  X_WATCH_SOURCE_ID,
  getWatchlistSymbols,
  type RedditPost,
  type XTweet,
} from '@/services/data-layer';

interface TruthPost {
  content: string;
  url: string;
  author: string;
  likes: number;
  reposts: number;
  created: string;
  sentiment?: string;
  sector?: string;
}

type Platform = 'all' | 'reddit' | 'truth' | 'x';

interface SocialMonitorData {
  reddit: RedditPost[];
  truth: TruthPost[];
  x: XTweet[];
}

const PLATFORM_META: Record<Platform, { label: string; color: string }> = {
  all: { label: 'All', color: 'var(--accent)' },
  reddit: { label: 'Reddit', color: '#ff4500' },
  truth: { label: 'Truth Social', color: '#1DA1F2' },
  x: { label: 'X / Twitter', color: '#1d9bf0' },
};

const TABS: { id: Platform; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'truth', label: 'Truth Social' },
  { id: 'x', label: 'X' },
];

const TRUTH_API = '/api/truthwatch?action=posts';

export class SocialMonitorPanel extends Panel {
  private activeTab: Platform = 'all';
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private data: SocialMonitorData = { reddit: [], truth: [], x: [] };
  private watchlistOnly = false;
  private watchlistBtn: HTMLElement | null = null;
  private refreshGen = 0;

  constructor() {
    super({ id: 'social-monitor', title: 'Social Monitor' });
    this.setupDataSubscriptions();
    this.render();
  }

  private setupDataSubscriptions(): void {
    dataLayer.subscribe(REDDIT_PULSE_SOURCE_ID, (d: any) => {
      this.data.reddit = d.posts || [];
      this.renderActiveTab();
    });
    dataLayer.subscribe(X_WATCH_SOURCE_ID, (d: any) => {
      this.data.x = d.tweets || [];
      this.renderActiveTab();
    });
  }

  public async refresh(): Promise<void> {
    const gen = ++this.refreshGen;
    await Promise.allSettled([
      dataLayer.fetch(REDDIT_PULSE_SOURCE_ID),
      dataLayer.fetch(X_WATCH_SOURCE_ID),
      this.fetchTruthPosts(),
    ]);
    if (gen !== this.refreshGen) return;
    this.renderActiveTab();
  }

  private async fetchTruthPosts(): Promise<void> {
    try {
      const res = await fetch(TRUTH_API);
      const json = await res.json();
      this.data.truth = json.posts || [];
    } catch {
      // silent
    }
  }

  public render(): void {
    if (!this.content) return;
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    // Tab bar
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'panel-tabs';
    this.content.appendChild(this.tabsEl);

    // Watchlist filter button
    this.watchlistBtn = document.createElement('button');
    this.watchlistBtn.className = 'panel-tab';
    this.watchlistBtn.textContent = this.watchlistOnly ? 'Watchlist' : 'All Symbols';
    this.watchlistBtn.addEventListener('click', () => {
      this.watchlistOnly = !this.watchlistOnly;
      if (this.watchlistBtn) this.watchlistBtn.textContent = this.watchlistOnly ? 'Watchlist' : 'All Symbols';
      this.renderActiveTab();
    });

    // List container
    this.listEl = document.createElement('div');
    this.listEl.className = 'sentiment-list';
    this.listEl.style.flex = '1';
    this.listEl.style.overflow = 'auto';
    this.content.appendChild(this.listEl);

    this.renderTabs();
    this.renderActiveTab();
  }

  private renderTabs(): void {
    if (!this.tabsEl) return;
    this.tabsEl.innerHTML = '';
    for (const t of TABS) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${t.id === this.activeTab ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.activeTab = t.id;
        this.renderTabs();
        this.renderActiveTab();
      });
      this.tabsEl.appendChild(btn);
    }
    this.tabsEl.appendChild(this.watchlistBtn!);
  }

  private getFilteredPosts(): { platform: string; title: string; meta: string; score: number; url: string }[] {
    const items: { platform: string; title: string; meta: string; score: number; url: string }[] = [];
    const watchSyms = this.watchlistOnly ? getWatchlistSymbols() : null;

    if (this.activeTab === 'all' || this.activeTab === 'reddit') {
      for (const p of this.data.reddit) {
        if (watchSyms && p.symbol && !watchSyms.includes(p.symbol)) continue;
        items.push({
          platform: 'reddit',
          title: p.title,
          meta: `r/${p.subreddit} · ${p.numComments} comments · ${p.author}`,
          score: p.score,
          url: p.url,
        });
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'truth') {
      for (const p of this.data.truth) {
        items.push({
          platform: 'truth',
          title: p.content.slice(0, 120) + (p.content.length > 120 ? '…' : ''),
          meta: `${p.author} · ${p.likes} likes · ${p.sector || 'general'}`,
          score: p.likes,
          url: p.url,
        });
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'x') {
      for (const p of this.data.x) {
        if (watchSyms && p.symbol && !watchSyms.includes(p.symbol)) continue;
        items.push({
          platform: 'x',
          title: p.text.slice(0, 120) + (p.text.length > 120 ? '…' : ''),
          meta: `@${p.author} · ${p.retweets} RTs`,
          score: p.likes,
          url: p.url,
        });
      }
    }

    return items.sort((a, b) => b.score - a.score);
  }

  private renderActiveTab(): void {
    if (!this.listEl) return;
    const items = this.getFilteredPosts();
    this.setCount(items.length);

    if (items.length === 0) {
      this.listEl.innerHTML = `<div class="panel-empty">No posts found</div>`;
      return;
    }

    this.listEl.innerHTML = items
      .map((item) => {
        const meta = PLATFORM_META[item.platform as Platform] || PLATFORM_META.all;
        return `
          <div class="sentiment-row" onclick="window.open('${item.url}', '_blank')" style="cursor:pointer">
            <div class="sentiment-row-header">
              <span class="sentiment-badge" style="background:${meta.color};color:#fff;font-size:10px;padding:2px 6px;border-radius:3px">${meta.label}</span>
              <span class="sentiment-score">${item.score.toLocaleString()}</span>
            </div>
            <div style="font-size:12px;margin:4px 0;opacity:0.9">${item.title}</div>
            <div style="font-size:10px;opacity:0.5">${item.meta}</div>
          </div>`;
      })
      .join('');
  }
}
```

**Step 2: Create SocialMonitorPlugin/plugin.ts**

```ts
import { registry } from '@/services/plugin-registry';
import { SocialMonitorPanel } from './Panel';

registry.register({
  id: 'social-monitor',
  name: 'Social Monitor',
  tab: 'news' as const,
  refreshIntervalMs: 3 * 60_000,
  dataSource: 'api' as const,
  panel: new SocialMonitorPanel(),
});
```

**Step 3: Add import to main.ts**

Add to the import block (after line ~49):
```ts
import './plugins/SocialMonitorPlugin/plugin';
```

**Step 4: Update DEFAULT_TAB_PANELS for news tab**

Replace the 3 individual social panels with the merged one:

```ts
// BEFORE
'financial-news': [
  'financial-news',
  'live-news',
  'social-sentiment',
  'reddit-pulse',
  'truth-watch',
  'x-watch',
],

// AFTER
'financial-news': [
  'financial-news',
  'live-news',
  'social-sentiment',
  'social-monitor',
],
```

**Step 5: Verify build**

Run: `npm run type:check && npm run lint && npm run test`
Expected: All pass

**Step 6: Commit**

```bash
git add src/plugins/SocialMonitorPlugin/ src/main.ts
git commit -m "feat: merge reddit-pulse, truth-watch, x-watch into Social Monitor panel"
```

---

## Task 3: Hide noise panels by default

**Why:** Tech Community (dev tool), LiveNews (static/placeholder), and Feishu (niche Chinese chat) clutter the default view. They should be available via Settings but not visible by default.

**Approach:** Remove these panel IDs from `DEFAULT_TAB_PANELS` arrays. The plugins stay registered in the plugin system (available in Settings > Panel Layout for re-enablement) but don't render by default. `PluginManifest` has no `hidden` field — visibility is controlled entirely by `DEFAULT_TAB_PANELS`.

**Files:**
- Modify: `src/main.ts:94-120` (DEFAULT_TAB_PANELS)

**Step 1: Remove panels from DEFAULT_TAB_PANELS**

```ts
// BEFORE (dashboard)
dashboard: ['vix-gauge', 'weather', 'world-clock', 'quick-links', 'map', 'insights', 'schedule', 'email'],
// AFTER — remove 'social'
dashboard: ['vix-gauge', 'weather', 'world-clock', 'quick-links', 'map', 'insights', 'schedule', 'email'],

// BEFORE (news - after Task 2)
'financial-news': ['financial-news', 'live-news', 'social-sentiment', 'social-monitor'],
// AFTER — remove 'live-news'
'financial-news': ['financial-news', 'social-sentiment', 'social-monitor'],

// BEFORE (devops)
devops: ['devops', 'code-status', 'feishu', 'system-monitor'],
// AFTER — remove 'feishu'
devops: ['devops', 'code-status', 'system-monitor'],
```

**Step 4: Verify build**

Run: `npm run type:check && npm run lint && npm run test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/plugins/SocialPlugin/plugin.ts src/plugins/LiveNewsPlugin/plugin.ts src/plugins/FeishuPlugin/plugin.ts src/main.ts
git commit -m "chore: hide Tech Community, LiveNews, Feishu by default"
```

---

## Task 4: Make DevOps tab opt-in

**Why:** For a pure financial analyst, the DevOps tab (Process Monitor, Code Status, System Monitor) is noise. It should exist for developer-traders but not be visible by default.

**Approach:** Hide the DevOps tab button in index.html via `style="display:none"`. The tab content section remains (so it can be shown via Settings or command palette). The 4 plugins stay registered.

**Files:**
- Modify: `index.html:36` (hide DevOps tab button)

**Step 1: Hide the DevOps tab button**

```html
<!-- BEFORE (index.html:36) -->
<button class="app-tab" data-tab="devops">DevOps</button>

<!-- AFTER -->
<button class="app-tab" data-tab="devops" style="display:none">DevOps</button>
```

**Step 2: Verify build**

Run: `npm run type:check && npm run lint && npm run test`
Expected: All pass

**Step 3: Commit**

```bash
git add index.html
git commit -m "chore: hide DevOps tab by default, make it opt-in"
```

---

## Task 5: Remove refresh from local-data panels

**Why:** 8 panels with `dataSource: 'local'` have `refreshIntervalMs: 5min` but local data only changes on user edit. The timer is pure overhead.

**Files:**
- Modify: `src/plugins/StrategyJournalPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/TradeReviewPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/PlaybookManagerPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/BacktestLogPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/HabitTrackerPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/HealthMetricsPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/RoutineSchedulerPlugin/plugin.ts` (remove refreshIntervalMs)
- Modify: `src/plugins/MentalCheckInPlugin/plugin.ts` (remove refreshIntervalMs)

**Step 1: Remove `refreshIntervalMs` from all 8 plugin manifests**

Each file has a line like `refreshIntervalMs: 5 * 60_000,` — delete it.

**Step 2: Verify build**

Run: `npm run type:check && npm run lint && npm run test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/plugins/StrategyJournalPlugin/plugin.ts src/plugins/TradeReviewPlugin/plugin.ts src/plugins/PlaybookManagerPlugin/plugin.ts src/plugins/BacktestLogPlugin/plugin.ts src/plugins/HabitTrackerPlugin/plugin.ts src/plugins/HealthMetricsPlugin/plugin.ts src/plugins/RoutineSchedulerPlugin/plugin.ts src/plugins/MentalCheckInPlugin/plugin.ts
git commit -m "perf: remove unnecessary refresh timers from 8 local-data panels"
```

---

## Task 6: Enhance AI Summary to be time-aware

**Why:** The Insights panel (AI Summary) is the closest thing to a daily briefing but has no auto-refresh and isn't time-aware. An expert needs "pre-market brief at 6 AM" and "post-market recap at 4 PM" automation.

**Approach:** Add time-of-day detection to the InsightsPanel that changes the default prompt/context based on market hours. Add an auto-brief feature that triggers at key times.

**Files:**
- Modify: `src/plugins/InsightsPlugin/Panel.ts` (add time-aware prompt selection)

**Step 1: Read current InsightsPanel implementation**

Understand the current prompt/template mechanism.

**Step 2: Add time-of-day detection**

```ts
type MarketPhase = 'pre-market' | 'market-open' | 'post-market' | 'after-hours';

function getMarketPhase(): MarketPhase {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute; // minutes since midnight
  const day = now.getDay();

  // Weekend
  if (day === 0 || day === 6) return 'after-hours';

  if (time < 570) return 'pre-market';      // before 9:30 AM ET (simplified)
  if (time < 960) return 'market-open';      // 9:30 AM - 4:00 PM
  if (time < 1080) return 'post-market';     // 4:00 PM - 6:00 PM
  return 'after-hours';
}

const PHASE_PROMPTS: Record<MarketPhase, string> = {
  'pre-market': 'Good morning. Generate a pre-market briefing: overnight news, today\'s macro calendar, pre-market movers, and key levels to watch.',
  'market-open': 'Market is open. Show real-time alerts, breaking news, and any position updates.',
  'post-market': 'Market closed. Generate an end-of-day recap: daily P&L, notable trades, and tomorrow\'s outlook.',
  'after-hours': 'After hours. Show any overnight developments and prepare for tomorrow.',
};
```

**Step 3: Use the phase prompt as default context**

When the panel mounts, inject the phase-appropriate prompt as the initial message context.

**Step 4: Verify build**

Run: `npm run type:check && npm run lint && npm run test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/plugins/InsightsPlugin/Panel.ts
git commit -m "feat: add time-of-day aware prompts to AI Summary panel"
```

---

## Task 7: Quality gates + final verification

**Why:** Ensure all changes compile, lint, and test cleanly.

**Step 1: Type check**

Run: `npm run type:check`
Expected: No errors

**Step 2: Lint**

Run: `npm run lint`
Expected: Only pre-existing warnings (no new errors)

**Step 3: Format**

Run: `npm run format:check`
Expected: Pass (or run `npm run format` to fix)

**Step 4: Test**

Run: `npm run test`
Expected: 63/63 tests pass

**Step 5: Manual verification checklist**

- [ ] Dashboard shows: VIX gauge, weather, world clock, quick links, map, insights, schedule, email
- [ ] Personal tab shows only: habits, health, routines, mental check-in
- [ ] News tab shows: financial-news, social-sentiment, social-monitor (merged)
- [ ] Social Monitor has tabs: All, Reddit, Truth Social, X
- [ ] Tech Community, LiveNews, Feishu not visible by default
- [ ] DevOps tab not visible in tab bar by default
- [ ] Strategy panels have no refresh timer running
- [ ] AI Summary shows time-appropriate prompt

**Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: final cleanup after coherence refactor"
```

---

## Summary of Changes

| Task | What | Impact |
|------|------|--------|
| 1 | Move weather/world-clock/quick-links to Dashboard | Fixes 2 tabs at once, enables ambient awareness |
| 2 | Merge reddit-pulse + truth-watch + x-watch → Social Monitor | Eliminates news tab overload |
| 3 | Hide Tech Community, LiveNews, Feishu by default | Declutters dashboard and news |
| 4 | Make DevOps tab opt-in | Removes noise for pure traders |
| 5 | Remove refresh from 8 local-data panels | Cleaner scheduler, no wasted timers |
| 6 | Time-aware AI Summary | Enables daily briefing workflow |
| 7 | Quality gates | Verify everything works |

**Net result:** 37 panels → 31 visible by default (6 hidden), 7 tabs with clear purposes, zero redundant social feeds, time-aware briefing capability.
