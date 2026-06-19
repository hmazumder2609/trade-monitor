# Social Sentiment 2.0 — Multi-Panel Design

**Date:** 2026-06-19
**Status:** Draft for review

## Principle

Each social media source gets its **own panel** that combines both **news feed** (what are people saying) and **sentiment** (how does the market feel). This mirrors the existing tab layout where each data domain (Macro, News, Trading, Strategy) has multiple panels.

## Tab Layout

```
News tab (renamed: "Social + News"):
  ├── FinancialNewsPanel (existing — RSS feeds)
  ├── LiveNewsPanel (existing — real-time news)
  ├── RedditPulsePanel (new — Reddit communities)
  ├── TruthWatchPanel (new — TruthSocial, Trump)
  ├── XWatchPanel (new — Twitter influencers & sentiment)
  └── SocialSentimentPanel (existing — to be deprecated or absorbed)
```

Each panel has its own tab, its own refresh interval, and its own configuration.

---

## Panel 1: RedditPulse — Trading Communities

**Purpose:** Track what retail trading communities are discussing. Combines news posts (DD, earnings) with sentiment data.

### Sources
- **10 subreddits** (configurable): wallstreetbets, stocks, options, thetagang, valueinvesting, tfsa_millionaires, CanadianInvestor, CryptoCurrency, Superstonk, wallstreetbetsOGs
- **Subreddit weight**: Each gets a signal weight (0.5–1.0) based on historical signal quality

### Layout (dual-purpose)

```
┌─────────────────────────────────────────────────────────────┐
│ [News Feed] [Sentiment] [By Subreddit]    [Watchlist Only]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ TAB 1: NEWS FEED — latest posts, sorted by score            │
│                                                             │
│  🟢 [DD] TSLA bull case analysis • r/wallstreetbets         │
│     ↑2.4k "Based on Q2 delivery data and margin expansion" │
│     🏷️ $TSLA $NVDA  2h ago                                │
│                                                             │
│  🟡 [news] NVDA earnings date confirmed • r/stocks          │
│     ↑891 "NVIDIA announces Q2 earnings for Aug 28"         │
│     🏷️ $NVDA  4h ago                                       │
│                                                             │
│  🔵 [discussion] Best TFSA growth picks 2026 • r/tfsa_...  │
│     ↑567 "REITs and dividend growth for tax-free accounts" │
│     🏷️ $REIT $XEQT  6h ago                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ TAB 2: SENTIMENT — weighted mention scoring per ticker      │
│                                                             │
│  $NVDA ████████████████░░░░░░░  142 wt  +0.76  🔥 breakout │
│  $TSLA ██████████████░░░░░░░░░  98 wt   +0.23              │
│  $AAPL █████████░░░░░░░░░░░░░░  65 wt   +0.58              │
│  $PLTR █████░░░░░░░░░░░░░░░░░░  38 wt   +0.54  🔥 breakout │
│                                                             │
│ (weight = weighted score, bar width = volume)               │
│ Click ticker → expand top 5 posts from that ticker          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ TAB 3: BY SUBREDDIT — posts grouped by source community     │
│                                                             │
│  [wallstreetbets] [+2.4k] [+891] [+567]                    │
│  [stocks]        [+432] [+321]                              │
│  [options]       [+234]                                     │
│  [tfsa_millionaires] [+567] [+123]                          │
│  (click to expand)                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Analysis
- **Weighted scoring**: `log(1+score) × subreddit_weight × content_type_weight`
- **Content types**: `dd` (analysis, ×1.5), `news` (×1.2), `sentiment` (hype, ×0.7), `meme` (×0.3)
- **Breakout detection**: Z-score >3σ on 1h mention velocity
- **Sentiment**: Keyword-based (existing) + negation window

### Data
- Public Reddit JSON API (no auth needed for reads)
- Optional OAuth for higher rate limits (existing `REDDIT_CLIENT_ID`/`SECRET`)
- Server route: `server/routes/reddit-pulse.ts` (new, separate from existing social-sentiment)
- Service: `src/services/reddit-pulse.ts` (new)
- Panel: `src/components/RedditPulsePanel.ts` (new)
- Refresh: every 3 min

---

## Panel 2: TruthWatch — TruthSocial

**Purpose:** Track Donald Trump's TruthSocial posts for market-moving statements on tariffs, trade policy, stocks, and crypto. Combines raw post feed with market impact analysis.

### Sources
- **TruthSocial public API** (no auth required)
  - Endpoint: `GET https://truthsocial.com/api/v1/accounts/{accountId}/statuses?limit=20`
  - Trump's account ID: `108267542530254673`
- Additional accounts configurable in settings

### Layout (dual-purpose)

```
┌─────────────────────────────────────────────────────────────┐
│ [Posts] [Market Impact]                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ TAB 1: POSTS — latest Truths, reverse-chronological         │
│                                                             │
│  🐦 4h ago • TruthSocial                                    │
│  "China tariffs are working. American industry is coming    │
│   back bigger and better than ever. We are winning bigly!"  │
│  🏷️ $DJT $TARIFF $SPY  📈 positive (pro-market)            │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🐦 6h ago • TruthSocial                                    │
│  "The Federal Reserve should cut rates. Now. Before it's    │
│   too late. We need to unlock the American economy!"        │
│  🏷️ $USD $BTC $TLT  📉 mixed (rate cut pressure)           │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🐦 Yesterday • TruthSocial                                 │
│  "Big news coming on AI infrastructure. We need to be the   │
│   dominant player. Not China. We have the best technology." │
│  🏷️ $NVDA $AMD $AI  📈 positive                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ TAB 2: MARKET IMPACT — ticker-level analysis                │
│                                                             │
│  Sectors mentioned this week:                               │
│  ● Tariffs/Trade ████████░░░░  (8 posts)  → bullish $XLI   │
│  ● Crypto        ██████░░░░░░  (6 posts)  → bullish $BTC   │
│  ● Fed/Rates     █████░░░░░░░  (5 posts)  → bearish $TLT   │
│  ● AI/Tech       ████░░░░░░░░  (4 posts)  → bullish $NVDA  │
│  ● Energy        ███░░░░░░░░░  (3 posts)  → bullish $XLE   │
│                                                             │
│  Ticker mentions:                                           │
│  ● $DJT  8 mentions   📈 +5.2% since first mention         │
│  ● $BTC  6 mentions   📈 +3.1%                              │
│  ● $NVDA 4 mentions   📉 -1.2%                              │
│  ● $TSLA 3 mentions   📈 +2.8%                              │
│                                                             │
│  🔥 Key signal: Trump mentioned tariffs 8 times this week.  │
│  Previous tariff tweet cycles caused 2-5% SPY moves.        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Analysis
- **Topic classification**: Categorize posts into sectors (tariffs/trade, crypto, Fed/rates, AI/tech, energy, China, elections)
- **Ticker extraction**: `$TICKER` patterns + known ticker-by-topic map (e.g., "tariffs" → `$XLI`, "AI" → `$NVDA`)
- **Impact scoring**: Per-post sentiment + historical follow-through (what happened after similar posts)
- **Frequency tracking**: How many posts per topic per day/week

### Data
- TruthSocial public API (no auth)
- Server route: `server/routes/truthwatch.ts` (new)
- Service: `src/services/truthwatch.ts` (new)
- Panel: `src/components/TruthWatchPanel.ts` (new)
- Refresh: every 3 min

---

## Panel 3: XWatch — Twitter/X Influencers

**Purpose:** Track Elon Musk, Cathie Wood, and other key figures on X/Twitter. Combines tweet feed with ticker sentiment.

### Sources
- **Twitter API v2** (needs `TWITTER_BEARER_TOKEN`)
- Configurable account list (default: elonmusk, CathieDWood, RayDalio)
- Free tier: 450 requests/15min — enough for 3-5 accounts × 10 tweets each

### Layout (dual-purpose)

```
┌─────────────────────────────────────────────────────────────┐
│ [Tweets] [Sentiment] [By Account]    [Filter: ▼ All]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ TAB 1: TWEETS — latest from tracked accounts                │
│                                                             │
│  🐦 @elonmusk  •  1h ago                                    │
│  "Tesla Q2 deliveries tracking well above expectations.     │
│   Optimus production timeline remains on schedule."         │
│  ♥ 24.5K  🔄 8.2K  🏷️ $TSLA ↗ (positive)                  │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🐦 @CathieDWood  •  3h ago                                 │
│  "Innovation is the key to productivity growth. We believe  │
│   AI, genomics, and fintech will lead the next cycle."      │
│  ♥ 3.2K  🔄 891  🏷️ $ARKK $AI $CRSP ↗ (positive)          │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🐦 @RayDalio  •  5h ago                                    │
│  "The debt cycle is entering a late-stage phase.            │
│   Diversification across geographies and asset classes      │
│   is more important than ever."                             │
│  ♥ 8.7K  🔄 2.1K  🏷️ $TLT $GLD $BTC ↔ (neutral)           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ TAB 2: SENTIMENT — aggregate sentiment by ticker            │
│                                                             │
│  $TSLA  ████████████████░░░░  0.62 (12 tweets, 3 accounts)  │
│  $BTC   ████████░░░░░░░░░░░  0.31  (5 tweets, 2 accounts)  │
│  $NVDA  ██████░░░░░░░░░░░░░  0.48  (4 tweets, 2 accounts)  │
│  $DOGE  ████░░░░░░░░░░░░░░░  0.15  (3 tweets, 1 account)  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ TAB 3: BY ACCOUNT — activity grouped by influencer          │
│                                                             │
│  @elonmusk        [12 tweets] [8 TSLA] [3 DOGE] [1 SPACE]  │
│  @CathieDWood      [5 tweets] [2 ARKK] [1 CRSP] [1 ROKU]  │
│  @RayDalio         [3 tweets] [1 TLT] [1 BTC] [1 GLD]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Analysis
- **Tweet-level sentiment**: Keyword-based (existing) with negation window
- **Aggregate scoring**: Per-ticker weighted by account authority (Elon > Cathie > Dalio)
- **Engagement weighting**: Tweets with high likes/retweets get higher weight
- **Topic tracking**: Categorize tweets into sectors (auto, crypto, AI, macro)

### Data
- Twitter API v2 (needs `TWITTER_BEARER_TOKEN`)
- Server route: `server/routes/xwatch.ts` (new)
- Service: `src/services/xwatch.ts` (new)
- Panel: `src/components/XWatchPanel.ts` (new)
- Refresh: every 3 min

---

## Shared Infrastructure

### Server utility: `server/utils/sentiment-analyzer.ts`

Shared analysis functions used by all three panels:

```typescript
// Weighted scoring
function weightedScore(posts: Post[], weights: WeightConfig): number

// Breakout detection (Z-score)
function detectBreakout(currentVelocity: number, history: number[]): boolean

// Sentiment keyword matching with negation window
function analyzeSentiment(text: string): { positive: number; negative: number; score: number }

// Content type classification
function classifyPost(title: string, body: string): 'dd' | 'news' | 'sentiment' | 'meme'

// Ticker extraction (shared)
function extractTickers(text: string): string[]
```

### Analysis pipeline (`server/utils/sentiment-analyzer.ts`)

```
Raw posts → ticker extraction → content classification → weighted scoring → sentiment → breakout check → correlated signal
```

### Cross-source correlation

A lightweight engine (`server/utils/signal-correlator.ts`) that runs after all panels refresh and identifies tickers mentioned across multiple sources:

```typescript
interface CorrelatedSignal {
  ticker: string;
  sources: Array<{ name: string; sentiment: number; postCount: number }>;
  sourceCount: number;
  consensusSentiment: number;
  conviction: 'high' | 'medium' | 'low';
}
```

Results are stored in-memory and optionally surfaced in each panel as a "🔥 mentioned in 3 communities" badge.

### Preferences additions (`src/config/preferences.ts`)

```typescript
export interface UserPreferences {
  // ... existing fields

  // RedditPulse
  trackedSubreddits: string[];           // 10 default subreddits
  redditContentFilters: string[];        // ['dd', 'news', 'sentiment', 'meme']

  // TruthWatch
  truthSocialAccountId: string;          // Trump's ID
  truthSocialAdditionalAccounts: string[];

  // XWatch
  xAccounts: string[];                   // elonmusk, CathieDWood, RayDalio
  xTweetMinEngagement: number;           // minimum likes to show
}
```

---

## Migration from SocialSentimentPanel

The existing `SocialSentimentPanel` has 3 tabs (Trending, Reddit Mentions, Twitter Sentiment). Its functionality is absorbed:

| Existing Tab | Absorbed By | Notes |
|-------------|-------------|-------|
| Trending | RedditPulse → Sentiment tab | Weighted scoring replaces raw counts |
| Reddit Mentions | RedditPulse → News Feed tab | More subreddits, better classification |
| Twitter Sentiment | XWatch → Sentiment tab | Account-level tracking replaces symbol-only search |

**Plan:** Keep `SocialSentimentPanel` registered but mark as deprecated in comments. Users can enable either the old or new panels in Settings → Panel Visibility. Remove after 2 releases.

---

## Implementation Plan

### Phase 1: Foundations (shared infrastructure)

| Task | Effort | Files |
|------|--------|-------|
| Create `server/utils/sentiment-analyzer.ts` | Medium | New file — shared scoring, breakout, sentiment |
| Create `server/utils/signal-correlator.ts` | Small | New file — cross-source correlation |
| Add preferences fields | Small | `src/config/preferences.ts` |
| Add settings-key entries for new panels | Small | `src/config/settings-keys.ts` |
| update `.env.example` with TruthSocial info | Small | `.env.example` |

### Phase 2: RedditPulse Panel

| Task | Effort | Files |
|------|--------|-------|
| Create `server/routes/reddit-pulse.ts` | Medium | New server route (enhanced subreddit parser) |
| Create `src/services/reddit-pulse.ts` | Small | New client service |
| Create `src/components/RedditPulsePanel.ts` | Large | New panel with 3 tabs |
| Register in main.ts, index.ts, SettingsModal | Small | Wiring |

### Phase 3: TruthWatch Panel

| Task | Effort | Files |
|------|--------|-------|
| Create `server/routes/truthwatch.ts` | Medium | New server route (TruthSocial API) |
| Create `src/services/truthwatch.ts` | Small | New client service |
| Create `src/components/TruthWatchPanel.ts` | Large | New panel with 2 tabs |
| Register in main.ts, index.ts, SettingsModal | Small | Wiring |

### Phase 4: XWatch Panel

| Task | Effort | Files |
|------|--------|-------|
| Create `server/routes/xwatch.ts` | Medium | New server route (Twitter API) |
| Create `src/services/xwatch.ts` | Small | New client service |
| Create `src/components/XWatchPanel.ts` | Large | New panel with 3 tabs |
| Register in main.ts, index.ts, SettingsModal | Small | Wiring |

### Phase 5: Integration

| Task | Effort | Notes |
|------|--------|-------|
| Wire signal-correlator into panels | Small | Badge showing "in 3 communities" |
| Register all 3 in News tab layout | Small | Replace `social-sentiment` in DEFAULT_TAB_PANELS |
| Mark old SocialSentimentPanel deprecated | Small | Comment in code |
| Update AGENTS.md | Small | Document new panels |

---

## Explicitly Excluded

| Feature | Reason |
|---------|--------|
| LLM sentiment analysis | Too slow/expensive for real-time panel refresh |
| Persistent mention history DB | In-memory rolling window sufficient for breakout detection |
| Facebook / Instagram / TikTok sourcing | No public API for market content |
| YouTube transcript analysis | Too expensive to process, limited signal |
| Real-time WebSocket | 3-min polling is sufficient for a dashboard |
| SentimentMatrixPanel (separate) | Correlation badges in each panel are sufficient |
| Trump tweet archive | Only live TruthSocial feed matters |

---

## Acceptance Criteria

- [ ] `RedditPulsePanel` shows News Feed, Sentiment, and By Subreddit tabs with weighted scoring
- [ ] `TruthWatchPanel` shows Posts and Market Impact tabs with Trump's TruthSocial feed
- [ ] `XWatchPanel` shows Tweets, Sentiment, and By Account tabs (when `TWITTER_BEARER_TOKEN` is set)
- [ ] All 3 panels degrade gracefully without API keys (show demo data + setup prompts)
- [ ] Breakout detection flags tickers with >3σ velocity spikes
- [ ] Cross-source correlation badges show "in N communities" across panels
- [ ] Existing `SocialSentimentPanel` continues working (deprecated but functional)
- [ ] Preferences: subreddit list, X accounts, TruthSocial account ID all configurable
- [ ] `npm run type:check` passes
- [ ] No new required API keys beyond existing
