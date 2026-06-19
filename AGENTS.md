# AGENTS.md — My Daily Monitor (trade-monitor)

## Quick Commands

| Task                        | Command                                |
| --------------------------- | -------------------------------------- |
| Install deps                | `npm install`                          |
| Dev (Vite + embedded API)   | `npm run dev`                          |
| Dev (standalone API server) | `npm run dev:api`                      |
| Dev (both)                  | `npm run dev:full`                     |
| Dev (terminal subproject)   | `npm run dev:terminal`                 |
| Dev (all three)             | `npm run dev:all`                      |
| Type check (client)         | `npm run type:check`                   |
| Type check (server)         | `tsc -p tsconfig.server.json --noEmit` |
| Lint                        | `npm run lint`                         |
| Lint + fix                  | `npm run lint:fix`                     |
| Format check                | `npm run format:check`                 |
| Format write                | `npm run format`                       |
| Test (run once)             | `npm run test`                         |
| Test (watch)                | `npm run test:watch`                   |
| Test coverage               | `npm run test:coverage`                |
| Build (client)              | `npm run build`                        |
| Build (server)              | `tsc -p tsconfig.server.json`          |
| Build (terminal)            | `npm run build:terminal`               |
| Build all                   | `npm run build:all`                    |
| Start prod server           | `npm run start`                        |

## Architecture

- **`src/`** — Main dashboard app (vanilla TS, Vite, 32 panel components)
  - `components/` — Panel classes (all extend `Panel.ts` base)
  - `services/` — Data fetching (stock, news, email, calendar, AI, etc.)
  - `config/` — Settings keys & preferences
  - `utils/` — Helpers (circuit breaker, sparkline, formatting, theme)
  - `agents/` — Trading agent (position-manager, executor)
  - `main.ts` — Entry: panel instantiation, grid layout, refresh scheduler
- **`server/`** — Standalone Express API (alternative to Vite plugin)
  - `routes/` — 18 route handlers (stock, news, github, email, snaptrade, options-flow, onchain, social-sentiment, etc.)
  - `auth.ts`, `logger.ts` — Middleware
- **`src/terminal/`** — Separate React + Vite subproject (own package.json, deps, build)

## Key Conventions

- **Path alias**: `@/` → `src/`
- **Panel pattern**: Every panel extends `Panel.ts` (loading/error states, mount/destroy)
- **Services**: Pure functions, no classes — `fetchX()`, `refreshX()` naming
- **Settings**: Stored in localStorage, managed via `services/settings-store.ts`
- **Refresh**: `RefreshScheduler` registers named tasks with intervals (visibility-aware)
- **API routes**: Embedded in Vite via `vite-api-plugin.ts` — no separate server needed for dev
- **Theme**: Dark/light via `theme-manager.ts`, applied in `index.html` inline script (flash-free)

## Testing

- **Framework**: Vitest (node environment)
- **Test files**: `tests/**/*.test.ts` (server routes, utils)
- **Coverage thresholds**: lines/functions 50%, branches 40%
- Run single test: `npx vitest run tests/server.test.ts`

## TypeScript

- **Client**: `tsconfig.json` — strict, bundler resolution, noEmit, DOM libs
- **Server**: `tsconfig.server.json` — outputs to `dist-server/`, Node libs only
- **Terminal**: `src/terminal/tsconfig.json` — separate config
- Always run both: `npm run type:check` (runs both configs)

## Setup

```bash
# Quick start (auto-installs, prompts for API keys, starts dev server):
./scripts/setup.sh

# One-shot (skip prompts):
./scripts/setup.sh --quick

# Production Docker:
./scripts/setup.sh --prod

# Manual:
cp .env.example .env   # then fill in keys
npm ci
npm run dev             # or npm run dev:full
```

## Environment

API keys are configured via the Settings modal (stored in localStorage, synced to `.env`).

### Required Keys (panels need these to function)

| Key                      | Service               | Get It At                                         | Panel(s)                                      |
| ------------------------ | --------------------- | ------------------------------------------------- | --------------------------------------------- |
| `FINNHUB_API_KEY`        | Finnhub (stocks)      | https://finnhub.io/register                       | Stocks, Trading, Portfolio                    |
| `GITHUB_PAT`             | GitHub (CI status)    | https://github.com/settings/tokens                | Code Status                                   |
| `SNAPTRADE_CLIENT_ID`    | SnapTrade (brokerage) | https://dashboard.snaptrade.com                   | Trading, TradeReview                          |
| `SNAPTRADE_CONSUMER_KEY` | SnapTrade             | (same dashboard)                                  | Trading                                       |
| `FRED_API_KEY`           | St. Louis Fed (macro) | https://fred.stlouisfed.org/docs/api/api_key.html | MacroCalendar, EconomicIndicators, YieldCurve |
| `FEISHU_APP_ID`          | Feishu/Lark           | https://open.feishu.cn/app                        | Feishu                                        |
| `OPENROUTER_API_KEY`     | OpenRouter (AI)       | https://openrouter.ai/keys                        | AI Insights, Trading Agent                    |

### Optional Keys (panels degrade gracefully without them)

| Key                    | Service            | Get It At                                                 | Panel(s)        |
| ---------------------- | ------------------ | --------------------------------------------------------- | --------------- |
| `NEWSAPI_KEY`          | NewsAPI            | https://newsapi.org/register                              | FinancialNews   |
| `GMAIL_*`              | Gmail OAuth2       | https://developers.google.com/gmail/api/quickstart/nodejs | Email, Schedule |
| `OUTLOOK_*`            | Microsoft Graph    | https://portal.azure.com > App registrations              | Email           |
| `FEISHU_APP_SECRET`    | Feishu             | (same app dashboard)                                      | Feishu          |
| `TWITTER_BEARER_TOKEN` | Twitter/X API v2   | https://developer.twitter.com/en/portal/dashboard         | SocialSentiment |
| `REDDIT_CLIENT_*`      | Reddit API         | https://www.reddit.com/prefs/apps                         | SocialSentiment |
| `CBOE_API_KEY`         | CBOE options data  | (optional, free)                                          | OptionsFlow     |
| `GLASSNODE_API_KEY`    | Glassnode on-chain | https://glassnode.com (paid)                              | OnChain         |
| `WHALE_ALERT_API_KEY`  | Whale Alert crypto | https://whale-alert.io/api                                | OnChain         |
| `SNAPTRAPE_USER_*`     | SnapTrade auth     | auto-filled after registration                            | Trading         |

### Verifying Keys

Open Settings → API Keys and click **▶ Test** next to any key. The test hits the provider's API and reports success or failure.

### Ports

- Vite dev server: `5173`
- Express API server: `3000` (or `PORT` env)

## Common Gotchas

1. **Two TypeScript configs** — type check both (`npm run type:check`)
2. **Terminal is separate** — has own `node_modules`, `package.json`, `vite.config.ts`
3. **Vite API plugin** — dev server handles API routes; production uses `server/index.ts`
4. **Husky pre-commit** — runs `lint-staged` (eslint --fix + prettier --write on \*.ts)
5. **No ESLint config file** — uses flat config in `eslint.config.js` (check root)
6. **Panel IDs** — must match `data-panel` attribute and `PANEL_BY_ID` in `main.ts`
7. **Tab switching** — pure DOM show/hide, no remounting; panels persist state

## File Locations to Know

- Panel registry: `src/components/index.ts`
- Service registry: `src/services/index.ts`
- Settings keys: `src/config/settings-keys.ts`
- Preferences: `src/config/preferences.ts`
- API route map: `vite-api-plugin.ts:22-42`
- Refresh intervals: `src/main.ts:356-381`
- Panel layout: `src/main.ts:105-149`
