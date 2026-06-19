# Trader Dashboard Expansion — Design Document

**Date:** 2026-06-18
**Approach:** A (Incremental extension of existing architecture)
**Scope:** Phases 1-3 (Foundation, Macro Tab, Strategy Tab)

## Architecture

### Tab Layout (ordered)
1. **Dashboard** — Map, Insights, Schedule, Weather, Email, Social, World Clock, Quick Links
2. **Macro** — MacroCalendar, EconomicIndicators, CentralBankTracker, YieldCurve
3. **News** — FinancialNews, News, LiveNews, SocialSentiment
4. **Trading** — Trading, Stocks, Portfolio, OptionsFlow, OnChain
5. **Strategy** — StrategyJournal, TradeReview, PlaybookManager, BacktestLog
6. **Habits** — HabitTracker, HealthMetrics, RoutineScheduler, MentalCheckIn
7. **DevOps** — DevOps, CodeStatus, Feishu, SystemMonitor

### Decisions
- **Storage:** localStorage (matches existing), migrate to IndexedDB when >5MB
- **Strategy text:** Markdown (fast, responsive)
- **SocialSentiment:** Watchlist-only to reduce API/noise
- **Options flow:** Start with free CBOE data
- **Habits:** Quantified (duration, quality 1-10) for traders
- **Trade import:** Use SnapTrade integration
- **API key testing:** Settings modal gets a "Test Connection" button per key

### New Services
| Service | Source | Refresh |
|---------|--------|---------|
| `macro.ts` | FRED API (free) | 15m |
| `strategy-store.ts` | localStorage | — |
| `habit-store.ts` | localStorage | — |
| `options-flow.ts` | CBOE (free) | 1m market hrs |
| `onchain.ts` | WhaleAlert free tier | 5m |
| `social-sentiment.ts` | Twitter API v2 + Reddit | 5m |

### AI Agent Extensions
- Add tools: strategy, habits, macro, options, onchain
- New quick actions: Weekly Review, Habit Check, Macro Regime, Options Flow Scan

## Implementation Phases

### Phase 1: Foundation
- New tab routing (7 tabs, reorderable)
- Settings keys for all new panels
- API key validation endpoint (`/api/health?action=test-key&service=xxx`)
- IndexedDB wrapper for large datasets (strategy entries, habit history)

### Phase 2: Macro Tab
- `macro.ts` service (FRED API: CPI, NFP, GDP, PMI, yields)
- `MacroCalendarPanel` — economic events by region, color by impact
- `EconomicIndicatorsPanel` — key series sparklines + YoY/MoM
- `CentralBankTrackerPanel` — speeches, rate probability, dot plot
- `YieldCurvePanel` — 2s10s, 3m10s, regime shading

### Phase 3: Strategy Tab
- `strategy-store.ts` — CRUD for strategies, trades, reviews, playbooks
- `StrategyJournalPanel` — Markdown entries, tag by setup, link trades
- `TradeReviewPanel` — SnapTrade import, win/loss tags, pattern detection
- `PlaybookManagerPanel` — CRUD setups, effectiveness scoring
- `BacktestLogPanel` — Parameter grids, results, equity curves

### Phase 4: Habits Tab (future)
### Phase 5: Trading Enhancements (future)
