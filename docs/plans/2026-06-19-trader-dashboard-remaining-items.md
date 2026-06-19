# Remaining Items — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Complete all remaining items from the trader dashboard expansion design doc: 3 missing AI agent tools, Habit Check quick action, pattern detection for trades, SocialSentiment watchlist filtering, and a SystemMonitor panel for the DevOps tab.

**Architecture:** All items are leaf additions — they add functionality to existing files without restructuring. AI tools follow the existing `ToolDef` pattern in `InsightsPanel.ts`. SystemMonitor follows the existing `Panel` base class pattern.

**Tech Stack:** TypeScript, vanilla DOM, existing services (strategy-store, habit-store, macro).

---

### Task 1: AI Agent — Add `strategy` tool

**Files:**
- Modify: `src/components/InsightsPanel.ts` — add tool entry to TOOLS array

**Step 1: Study the existing tool pattern**

Read `src/components/InsightsPanel.ts` lines 115-432 to confirm the ToolDef interface and existing tool fetch patterns (e.g., the `news` tool at lines 163-201).

**Step 2: Add the `strategy` tool entry**

Insert a new ToolDef object into the TOOLS array. Place it before the `search` tool (last entry). The tool must:

- name: `'strategy'`
- keywords focusing on strategy/journal/playbook/trade terms
- fetch() that returns a formatted string with prefix `STRATEGY DATA:`

Implementation:

```typescript
{
  name: 'strategy',
  keywords: [
    'strategy', 'journal', 'playbook', 'trade', 'review', 'backtest',
    'pnl', 'win', 'loss', '策略', '交易', '回测',
  ],
  fetch: async () => {
    try {
      const { getStrategies, getTrades, getPlaybooks } = await import('@/services/strategy-store');
      const [strategies, trades, playbooks] = [getStrategies(), getTrades(), getPlaybooks()];
      const parts: string[] = [];
      if (strategies.length > 0) {
        parts.push(
          `STRATEGIES (${strategies.length}):\n${strategies.slice(0, 5).map(s => `- ${s.title}${s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : ''}`).join('\n')}`
        );
      }
      if (trades.length > 0) {
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl <= 0);
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        parts.push(
          `TRADES (${trades.length} total, ${wins.length}W / ${losses.length}L):\n` +
          `Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}\n` +
          trades.slice(0, 5).map(t => `- ${t.symbol} ${t.direction.toUpperCase()} ${t.pnl >= 0 ? '📈' : '📉'} ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%)`).join('\n')
        );
      }
      if (playbooks.length > 0) {
        parts.push(
          `PLAYBOOKS (${playbooks.length}):\n${playbooks.slice(0, 3).map(p => `- ${p.name} (effectiveness: ${(p.effectivenessScore * 100).toFixed(0)}%)`).join('\n')}`
        );
      }
      return parts.join('\n\n') || 'STRATEGY DATA: No strategy data recorded';
    } catch { return 'STRATEGY DATA: Failed to fetch'; }
  },
}
```

**Step 3: Verify**

Run: `npm run type:check`
Expected: clean exit (no errors)

**Step 4: Format**

Run: `npx prettier --write src/components/InsightsPanel.ts`

---

### Task 2: AI Agent — Add `habits` tool

**Files:**
- Modify: `src/components/InsightsPanel.ts` — add tool entry to TOOLS array

**Step 1: Add the `habits` tool entry**

Insert another ToolDef before `search`. Must have:

- name: `'habits'`
- keywords: habit, streak, health, sleep, exercise, mood, routine terms
- fetch() returns formatted string with prefix `HABITS:`

```typescript
{
  name: 'habits',
  keywords: [
    'habit', 'streak', 'health', 'sleep', 'exercise', 'mood',
    'routine', 'checkin', 'energy', 'stress', '习惯', '健康', '情绪',
    'briefing', '简报',
  ],
  fetch: async () => {
    try {
      const { getHabits, getTodayLogs, getTodayCheckIn, getHealthMetrics } = await import('@/services/habit-store');
      const [habits, logs, checkin, metrics] = [getHabits(), getTodayLogs(), getTodayCheckIn(), getHealthMetrics()];
      const parts: string[] = [];
      if (habits.length > 0) {
        const tracked = habits.filter(h => logs.some(l => l.habitId === h.id));
        parts.push(
          `HABITS (${habits.length} total, ${tracked.length} tracked today):\n${habits.map(h => {
            const log = logs.find(l => l.habitId === h.id);
            return log
              ? `- ✅ ${h.name}: ${log.duration}${h.unit} (quality ${log.quality}/10)`
              : `- ⬜ ${h.name}: not logged yet`;
          }).join('\n')}`
        );
      }
      if (checkin) {
        parts.push(
          `MENTAL CHECK-IN:\nMood: ${checkin.mood}/10 | Energy: ${checkin.energy}/10 | Stress: ${checkin.stress}/10`
        );
      }
      if (metrics.length > 0) {
        const latest = metrics.slice(-3);
        parts.push(
          `HEALTH METRICS:\n${latest.map(m => `- ${m.type}: ${m.value} ${m.unit} (${m.date})`).join('\n')}`
        );
      }
      return parts.join('\n\n') || 'HABITS: No habit data recorded';
    } catch { return 'HABITS: Failed to fetch'; }
  },
}
```

**Step 2: Verify**

Run: `npm run type:check`
Expected: clean

**Step 3: Format**

Run: `npx prettier --write src/components/InsightsPanel.ts`

---

### Task 3: AI Agent — Add `macro` tool

**Files:**
- Modify: `src/components/InsightsPanel.ts` — add tool entry to TOOLS array

**Step 1: Add the `macro` tool entry**

Insert before `search`. Must have:

- name: `'macro'`
- keywords: macro, economic, gdp, cpi, unemployment, fed, yield curve, inflation terms
- fetch() fetches from macro service and returns formatted string with prefix `MACRO:`

```typescript
{
  name: 'macro',
  keywords: [
    'macro', 'economic', 'gdp', 'cpi', 'inflation', 'unemployment',
    'fed', 'federal reserve', 'yield curve', 'interest rate', '宏观',
    '经济', '通胀', 'briefing', '简报',
  ],
  fetch: async () => {
    try {
      const { fetchMacroIndicators, fetchYieldCurve } = await import('@/services/macro');
      const [indicators, yieldData] = await Promise.all([
        fetchMacroIndicators().catch(() => [] as any[]),
        fetchYieldCurve().catch(() => ({ yields: [], spreads: {} } as any)),
      ]);
      const parts: string[] = [];
      if (indicators.length > 0) {
        parts.push(
          `ECONOMIC INDICATORS:\n${indicators.map(i =>
            `- ${i.name}: ${i.value != null ? i.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}${i.date ? ` (${i.date})` : ''}`
          ).join('\n')}`
        );
      }
      const spreads = yieldData.spreads || {};
      const spreadEntries = Object.entries(spreads).filter(([_, v]) => v != null);
      if (spreadEntries.length > 0) {
        parts.push(
          `YIELD CURVE SPREADS (bp):\n${spreadEntries.map(([k, v]) => {
            const bp = ((v as number) * 100).toFixed(1);
            const isInverted = (v as number) < 0;
            return `- ${k}: ${bp}bp${isInverted ? ' 🔴 INVERTED' : ''}`;
          }).join('\n')}`
        );
      }
      return parts.join('\n\n') || 'MACRO: No economic data available (configure FRED API key in Settings)';
    } catch { return 'MACRO: Failed to fetch'; }
  },
}
```

**Step 2: Verify**

Run: `npm run type:check`
Expected: clean

**Step 3: Format**

Run: `npx prettier --write src/components/InsightsPanel.ts`

---

### Task 4: AI Agent — Add `Habit Check` quick action + update `formatRawBriefing`

**Files:**
- Modify: `src/components/InsightsPanel.ts` — add QUICK_ACTIONS entry, add formatRawBriefing parser

**Step 1: Add Habit Check quick action**

Add to the QUICK_ACTIONS array (before "View Tasks"):

```typescript
{
  label: '✅ Habit Check',
  prompt: 'Check my habits today — which ones I have logged, my mental check-in status, and recent health metrics.',
},
```

**Step 2: Add formatRawBriefing parser for habit section**

Add after the email section parser (after the emailMatch block):

```typescript
// Parse habits
const habitsMatch = context.match(
  /HABITS[^:]*:([\s\S]*?)(?=\n\n|WEATHER|STOCKS|NEWS|SCHEDULE|EMAIL|MACRO|STRATEGY|$)/,
);
if (habitsMatch) {
  sections.push(`✅ Habits\n${habitsMatch[1].trim()}`);
}
```

**Step 3: Verify**

Run: `npm run type:check`
Expected: clean

**Step 4: Format**

Run: `npx prettier --write src/components/InsightsPanel.ts`

---

### Task 5: TradeReview — Pattern Detection

**Files:**
- Modify: `src/components/TradeReviewPanel.ts` — add pattern analysis section

**Step 1: Read current TradeReviewPanel.ts**

Read `src/components/TradeReviewPanel.ts` to understand its full structure. Note how trades are filtered by win/loss and how the trade list is rendered.

**Step 2: Add pattern detection analysis**

After the filter tabs and before the trade list, add a pattern analysis summary section:

```typescript
// After filter tabs
const patternEl = document.createElement('div');
patternEl.className = 'trade-patterns';
patternEl.style.cssText = 'padding:8px;font-size:12px;';
this.content.appendChild(patternEl);
```

In the `render()` method (or a new `renderPatterns()` method called alongside `render()`):

```typescript
private renderPatterns(trades: TradeReview[]): void {
  const el = this.content.querySelector('.trade-patterns');
  if (!el) return;
  if (trades.length < 3) {
    el.innerHTML = '';
    return;
  }

  // Analyze patterns
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const total = trades.length;
  const winRate = total > 0 ? (wins.length / total * 100).toFixed(0) : '0';

  // Best/worst symbols
  const bySymbol = new Map<string, { wins: number; losses: number; totalPnl: number }>();
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, { wins: 0, losses: 0, totalPnl: 0 });
    const d = bySymbol.get(t.symbol)!;
    d.totalPnl += t.pnl;
    if (t.pnl > 0) d.wins++; else d.losses++;
  }
  const bestSymbol = [...bySymbol.entries()].sort((a, b) => b[1].totalPnl - a[1].totalPnl).slice(0, 3);
  const worstSymbol = [...bySymbol.entries()].sort((a, b) => a[1].totalPnl - b[1].totalPnl).slice(0, 3);

  // Direction analysis
  const longTrades = trades.filter(t => t.direction === 'long');
  const shortTrades = trades.filter(t => t.direction === 'short');
  const longWinRate = longTrades.length > 0 ? (longTrades.filter(t => t.pnl > 0).length / longTrades.length * 100).toFixed(0) : '0';
  const shortWinRate = shortTrades.length > 0 ? (shortTrades.filter(t => t.pnl > 0).length / shortTrades.length * 100).toFixed(0) : '0';

  // Average P&L
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length : 0;

  // Total
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);

  el.innerHTML = `
    <div class="trade-pattern-header">📊 Pattern Analysis</div>
    <div class="trade-pattern-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;">
      <div class="trade-pattern-stat"><span class="trade-pat-label">Win Rate</span><span class="trade-pat-value" style="color:${+winRate >= 50 ? 'var(--green)' : 'var(--red)'}">${winRate}%</span></div>
      <div class="trade-pattern-stat"><span class="trade-pat-label">Total P&L</span><span class="trade-pat-value" style="color:${totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</span></div>
      <div class="trade-pattern-stat"><span class="trade-pat-label">Avg Win</span><span class="trade-pat-value" style="color:var(--green)">+$${avgWin.toFixed(2)}</span></div>
      <div class="trade-pattern-stat"><span class="trade-pat-label">Avg Loss</span><span class="trade-pat-value" style="color:var(--red)">-$${avgLoss.toFixed(2)}</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
      <div>
        <div style="color:var(--text-muted);margin-bottom:2px;">Long: ${longWinRate}% win rate (${longTrades.length} trades)</div>
        <div style="color:var(--text-muted);">Short: ${shortWinRate}% win rate (${shortTrades.length} trades)</div>
      </div>
      <div>
        <div style="color:var(--text-muted);margin-bottom:2px;">Best: ${bestSymbol.map(([s, d]) => `${s} ${d.totalPnl >= 0 ? '+' : ''}$${d.totalPnl.toFixed(0)}`).join(', ')}</div>
        <div style="color:var(--text-muted);">Worst: ${worstSymbol.map(([s, d]) => `${s} ${d.totalPnl >= 0 ? '+' : ''}$${d.totalPnl.toFixed(0)}`).join(', ')}</div>
      </div>
    </div>`;
}
```

**Step 3: Wire renderPatterns into refresh()**

Add `this.renderPatterns(trades);` call after `this.render(trades)` in the `refresh()` method.

**Step 4: Verify**

Run: `npm run type:check`
Expected: clean

**Step 5: Format**

Run: `npx prettier --write src/components/TradeReviewPanel.ts`

---

### Task 6: SocialSentiment — Watchlist-only filtering

**Files:**
- Modify: `src/components/SocialSentimentPanel.ts` — add watchlist filter toggle

**Step 1: Read current SocialSentimentPanel.ts**

Read `src/components/SocialSentimentPanel.ts` to find where it calls `fetchTrending()` and `fetchMentions()`. Note how the `mentions` response is used.

**Step 2: Add watchlist symbols source**

Import `getStockSymbols` from settings-store:

```typescript
import { getStockSymbols } from '@/services/settings-store';
```

**Step 3: Add filter by watchlist toggle**

In the render/build methods, add a toggle button "Watchlist Only" next to the tab buttons. Store state as `private watchlistOnly = true;`.

When `watchlistOnly` is true:
- Call `fetchTrending(getStockSymbols())` and `fetchMentions(getStockSymbols())`
- If the server already filters by symbols, pass them as query params
- The server route accepts `?symbols=AAPL,MSFT,...` as a filter

When `watchlistOnly` is false:
- Call `fetchTrending()` and `fetchMentions()` with no filter (show all)

The toggle button should look like:
```typescript
const filterBtn = document.createElement('button');
filterBtn.className = `trading-btn ${this.watchlistOnly ? 'trading-submit-btn' : 'trading-btn-outline'}`;
filterBtn.textContent = this.watchlistOnly ? '📋 Watchlist' : '🌐 All Symbols';
filterBtn.style.cssText = 'padding:4px 10px;font-size:11px;';
filterBtn.addEventListener('click', () => {
  this.watchlistOnly = !this.watchlistOnly;
  this.refresh();
});
```

**Important fix:** The `fetchMentions()` and `fetchTrending()` service functions already support optional `symbols` param — they pass it as a query string `?symbols=...`. If the current service doesn't pass symbols, update the fetch URL to include `&symbols=${symbols.join(',')}` when `symbols` is provided.

**Step 4: Refresh calls must pass symbols**

In the `refresh()` method, change calls to:
```typescript
const symbols = this.watchlistOnly ? getStockSymbols() : undefined;

const [trendingRes, mentionsRes] = await Promise.allSettled([
  fetchTrending(symbols),
  fetchMentions(symbols),
]);
```

**Step 5: Verify**

Run: `npm run type:check`
Expected: clean

**Step 6: Format**

Run: `npx prettier --write src/components/SocialSentimentPanel.ts`

---

### Task 7: SystemMonitor Panel for DevOps Tab

**Files:**
- Create: `src/components/SystemMonitorPanel.ts`
- Modify: `src/components/index.ts` — add export
- Modify: `src/main.ts` — add instance, PANEL_BY_ID, DEFAULT_TAB_PANELS, refresh scheduler, command palette

**Step 1: Create SystemMonitorPanel.ts**

Create a new panel that shows system health metrics. Follow the Panel base class pattern exactly.

```typescript
import { Panel } from './Panel';

interface SystemMetrics {
  cpu: number;
  memoryUsedPercent: number;
  uptime: number;
}

interface ProbeResult {
  url: string;
  ok: boolean;
  latencyMs: number;
}

export class SystemMonitorPanel extends Panel {
  private metrics: SystemMetrics | null = null;
  private probes: ProbeResult[] = [];

  constructor() {
    super({ id: 'system-monitor', title: 'System Monitor', className: 'panel-wide' });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '8px';
  }

  async refresh(): Promise<void> {
    this.setFetching(true);
    try {
      const resp = await fetch('/api/health');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.metrics = data as SystemMetrics;
      this.probes = (data.probes || []) as ProbeResult[];
      this.render();
    } catch {
      this.showError('Failed to fetch system health', () => this.refresh());
    } finally {
      this.setFetching(false);
    }
  }

  private render(): void {
    if (!this.metrics) return;
    this.content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div class="metric-card">
          <div class="metric-value" style="color:${this.metrics.cpu > 80 ? 'var(--red)' : this.metrics.cpu > 50 ? 'var(--yellow)' : 'var(--green)'}">${this.metrics.cpu.toFixed(1)}%</div>
          <div class="metric-label">CPU</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color:${this.metrics.memoryUsedPercent > 80 ? 'var(--red)' : this.metrics.memoryUsedPercent > 50 ? 'var(--yellow)' : 'var(--green)'}">${this.metrics.memoryUsedPercent.toFixed(1)}%</div>
          <div class="metric-label">Memory</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${Math.floor(this.metrics.uptime / 3600)}h</div>
          <div class="metric-label">Uptime</div>
        </div>
      </div>
      ${this.probes.length > 0 ? `
        <div style="font-size:12px;">
          <div style="color:var(--text-muted);margin-bottom:4px;">Server Probes</div>
          ${this.probes.map(p => `
            <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
              <span style="color:${p.ok ? 'var(--green)' : 'var(--red)'}">${p.ok ? '●' : '○'}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escape(p.url)}</span>
              <span style="color:var(--text-muted)">${p.ok ? `${p.latencyMs}ms` : 'DOWN'}</span>
            </div>
          `).join('')}
        </div>
      ` : '<div class="panel-empty">No server probes configured. Add URLs in Settings.</div>'}
    `;
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
```

**Step 2: Register in barrel export**

In `src/components/index.ts`, add after the existing DevOps panel exports:

```typescript
export { SystemMonitorPanel } from './SystemMonitorPanel';
```

**Step 3: Register in main.ts**

In `src/main.ts`:

A. **Import**: Add `SystemMonitorPanel` to the import block from `'./components'`

B. **Instance**: Add after the feishuPanel line:
```typescript
const systemMonitorPanel = new SystemMonitorPanel();
```

C. **PANEL_BY_ID**: Add:
```typescript
'system-monitor': systemMonitorPanel,
```

D. **DEFAULT_TAB_PANELS devops**: Change from `['devops', 'code-status', 'feishu']` to:
```typescript
devops: ['devops', 'code-status', 'feishu', 'system-monitor'],
```

E. **Refresh scheduler**: Add:
```typescript
{ name: 'system-monitor', fn: () => systemMonitorPanel.refresh(), intervalMs: 60_000 },
```

F. **Command palette**: Add at the end of the Refresh All list:
```typescript
'system-monitor',
```

G. **Command palette navigation**: Add:
```typescript
{
  label: 'System Monitor',
  description: 'Jump to system monitor panel',
  action: () => scrollToPanel('system-monitor'),
  keywords: ['system', 'health', 'cpu', 'memory', 'uptime', 'probe'],
},
```

**Step 4: Update SettingsModal.ts**

Add to the DevOps TAB_PANEL_DEFS:
```typescript
{ id: 'system-monitor', label: 'System Monitor' },
```

**Step 5: Verify**

Run: `npm run type:check`
Expected: clean

**Step 6: Format**

Run: `npx prettier --write src/components/SystemMonitorPanel.ts src/components/index.ts src/main.ts src/components/SettingsModal.ts`

---

### Final Verification

Run: `npm run type:check && npm run format:check`
Expected: clean exit, zero warnings from changed files

---

## Summary of All Changes

| Task | Files Modified | Files Created |
|------|---------------|---------------|
| 1. Strategy tool | `src/components/InsightsPanel.ts` | — |
| 2. Habits tool | `src/components/InsightsPanel.ts` | — |
| 3. Macro tool | `src/components/InsightsPanel.ts` | — |
| 4. Habit Check + briefing | `src/components/InsightsPanel.ts` | — |
| 5. Trade pattern detection | `src/components/TradeReviewPanel.ts` | — |
| 6. Watchlist filtering | `src/components/SocialSentimentPanel.ts` | — |
| 7. SystemMonitor panel | `src/components/index.ts`, `src/main.ts`, `src/components/SettingsModal.ts` | `src/components/SystemMonitorPanel.ts` |

Total: 5 files modified, 1 file created.
