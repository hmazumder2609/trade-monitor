# Social Sentiment 2.0 — Implementation Plan

**Goal:** Build 3 new source-specific social media panels (RedditPulse, TruthWatch, XWatch) with shared analysis infrastructure, each combining news feed + sentiment.

**Architecture:** One shared server-side analysis utility, then 3 independent panels (each = server route + client service + panel component). All panels register in the News tab. Old SocialSentimentPanel deprecated.

**Tech Stack:** TypeScript, vanilla DOM panels, Express server routes, existing Panel base class.

---

## Phase 1: Shared Analysis Infrastructure

### Task 1.1: Create `server/utils/sentiment-analyzer.ts`

Shared analysis functions used by all 3 panel routes:

- `weightedScore(posts, weightConfig)` — log-normalized scoring
- `detectBreakout(currentVelocity, history[])` — Z-score >3σ anomaly detection
- `analyzeSentiment(text)` — keyword + negation-window sentiment, returns `{ positive, negative, score }`
- `classifyContent(title, body)` — returns `'analysis' | 'news' | 'sentiment' | 'meme'`
- `extractTickers(text)` — shared ticker extraction (`$TICKER` + bare uppercase matches)

### Task 1.2: Create `server/utils/signal-correlator.ts`

Cross-source correlation engine:

- `CorrelatedSignal` interface: ticker, sources[], sourceCount, consensusSentiment, conviction
- `correlateSignals(panelResults[])` — takes results from all 3 panels and finds tickers mentioned in multiple sources
- In-memory store with 5min TTL

### Task 1.3: Update preferences

- Add `trackedSubreddits`, `truthSocialAccountId`, `xAccounts` to `UserPreferences` + `DEFAULT_PREFERENCES`

---

## Phase 2: RedditPulsePanel

### Task 2.1: Create `server/routes/reddit-pulse.ts`

- Pulls from configurable subreddits (query param or default list)
- Uses existing Reddit public JSON API + optional OAuth
- Applies weighted scoring (log+authority+content-type) from `sentiment-analyzer`
- Returns `{ posts[], mentions[] }` — both raw posts and aggregated sentiment
- Falls back to demo data

### Task 2.2: Create `src/services/reddit-pulse.ts`

- 3 circuit-broken fetch functions: `fetchPosts()`, `fetchSentiment()`, `fetchBySubreddit()`
- Type definitions: `RedditPost`, `RedditMention`

### Task 2.3: Create `src/components/RedditPulsePanel.ts`

- 3-tab panel: News Feed (posts with content-type badges), Sentiment (weighted ticker list), By Subreddit (grouped)
- Watchlist-only filter toggle
- Expandable posts on ticker click
- Refresh every 3 min

---

## Phase 3: TruthWatchPanel

### Task 3.1: Create `server/routes/truthwatch.ts`

- Fetches from TruthSocial public API `GET /api/v1/accounts/{id}/statuses?limit=20`
- Topic classification (tariffs, crypto, Fed, AI, energy, China)
- Ticker extraction + sentiment per post
- Returns `{ posts[], analysis{topicBreakdown, tickerMentions} }`
- Falls back to demo data

### Task 3.2: Create `src/services/truthwatch.ts`

- 2 fetch functions: `fetchPosts()`, `fetchMarketImpact()`
- Type definitions

### Task 3.3: Create `src/components/TruthWatchPanel.ts`

- 2-tab panel: Posts (reverse-chronological with ticker tags), Market Impact (sector + ticker breakdown)
- Refresh every 3 min

---

## Phase 4: XWatchPanel

### Task 4.1: Create `server/routes/xwatch.ts`

- Twitter API v2 for configured accounts (default: elonmusk, CathieDWood, RayDalio)
- Tweet-level sentiment + ticker extraction
- Engagement-weighted scoring
- Returns `{ tweets[], sentiment[], byAccount[] }`
- Demo fallback when no TWITTER_BEARER_TOKEN

### Task 4.2: Create `src/services/xwatch.ts`

- 3 fetch functions: `fetchTweets()`, `fetchSentiment()`, `fetchByAccount()`
- Type definitions

### Task 4.3: Create `src/components/XWatchPanel.ts`

- 3-tab panel: Tweets (with engagement metrics), Sentiment (aggregate per ticker), By Account
- Account filter dropdown
- Degrades gracefully without API key

---

## Phase 5: Registration + Integration

### Task 5.1: Register all 3 panels

- `src/components/index.ts` — add exports
- `src/main.ts` — add instances, PANEL_BY_ID, DEFAULT_TAB_PANELS, refresh scheduler (3 min each), command palette
- `src/components/SettingsModal.ts` — add panel visibility entries
- Mark old SocialSentimentPanel deprecated in comments

### Task 5.2: Wire shared index.ts barrel exports

- `server/utils/index.ts` — re-export sentiment-analyzer + signal-correlator
- Ensure all route handlers import from shared utils

### Task 5.3: Update AGENTS.md + .env.example

- Add new panel descriptions
- Document TruthSocial (no key) vs Twitter (bearer token) requirements

---

## Verification

After all tasks:
```bash
npm run type:check && npx prettier --check "src/**/*.ts" "server/**/*.ts"
```
