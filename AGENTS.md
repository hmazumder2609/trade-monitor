# AGENTS.md — trade-monitor

## Quick Commands

| Task                        | Command                                |
| --------------------------- | -------------------------------------- |
| Install deps                | `npm install`                          |
| Dev (Vite + embedded API)   | `npm run dev`                          |
| Dev (standalone API server) | `npm run dev:api`                      |
| Dev (both)                  | `npm run dev:full`                     |
| Dev (terminal subproject)   | `npm run dev:terminal`                 |
| Dev (all three)             | `npm run dev:all`                      |
| Type check (client)         | `npx tsc --noEmit`                     |
| Type check (server)         | `tsc -p tsconfig.server.json --noEmit` |
| Type check (both)           | `npm run type:check`                   |
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
| Run single test             | `npx vitest run tests/server.test.ts`  |

## Architecture

Three separate codebases coexist in one repo:

### Main dashboard (`src/`) — Vanilla TS + Vite
- `components/` — Panel classes (all extend `Panel.ts` base)
- `services/` — Data fetching (pure functions, `fetchX()` naming)
- `plugins/` — **Plugin system**: each panel is a self-registering plugin (27 plugins in `main.ts`)
- `config/` — Settings keys & preferences
- `utils/` — Helpers (circuit breaker, sparkline, formatting, theme)
- `agents/` — Trading agent (position-manager, executor)
- `main.ts` — Entry: plugin registration, panel instantiation, 7 tabs, refresh scheduler

### API server (`server/`) — Express
- `routes/` — 25 API endpoints (stock, news, github, email, snaptrade, options-flow, onchain, social-sentiment, etc.)
- `auth.ts`, `logger.ts` — Middleware
- `index.ts` — Standalone server (port 3000)

### Terminal subproject (`src/terminal/`) — React + Vite + Express
- **Completely separate**: own `package.json`, `node_modules`, `vite.config.ts`
- Uses pnpm for dependency management
- PostgreSQL via drizzle-orm
- Remotion for video rendering
- Runs on port 5000

## Key Conventions

- **Path alias**: `@/` → `src/`
- **Plugin pattern**: Each plugin in `src/plugins/` self-registers via side-effect import in `main.ts`; must export a panel ID matching `data-panel` attribute
- **Panel base**: All panels extend `Panel.ts` (loading/error states, mount/destroy)
- **Services**: Pure functions, no classes — `fetchX()`, `refreshX()` naming
- **Settings**: Stored in localStorage, managed via `services/settings-store.ts`
- **Refresh**: `RefreshScheduler` registers named tasks with intervals (visibility-aware)
- **API routes**: Embedded in Vite via `vite-api-plugin.ts` (lines 33-55 map all routes) — no separate server needed for dev
- **Theme**: Dark/light via `theme-manager.ts`, applied in `index.html` inline script (flash-free)
- **Command Palette**: Keyboard-driven navigation (Cmd/Ctrl+K); commands registered via `registerCommands()`
- **Custom Panels**: Users can add iframe panels via the command palette

## Testing

- **Framework**: Vitest (node environment)
- **Test files**: `tests/**/*.test.ts` (server routes, utils)
- **Terminal tests**: `src/terminal/server/*.test.ts` and `src/terminal/client/src/lib/*.test.ts` (Node test runner, not Vitest)
- **Coverage thresholds**: lines/functions 50%, branches 40%
- **Run single test**: `npx vitest run tests/server.test.ts`

## TypeScript

- **Client**: `tsconfig.json` — strict, bundler resolution, noEmit, DOM libs
- **Server**: `tsconfig.server.json` — outputs to `dist-server/`, Node libs only
- **Terminal**: `src/terminal/tsconfig.json` — separate config
- **CI runs both**: `npx tsc --noEmit` then `tsc -p tsconfig.server.json --noEmit`

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
- Terminal dev server: `5000`

## CI (GitHub Actions)

Quality gates run on push/PR to main/master/develop:

1. **Type check** (both configs) → `npx tsc --noEmit` + `tsc -p tsconfig.server.json --noEmit`
2. **Lint** → `npm run lint`
3. **Format check** → `npm run format:check`
4. **Test + coverage** → `npm run test:coverage`
5. **Dependency audit** → `npm audit --audit-level=high`
6. **Docker build** (after quality + test pass)

## Common Gotchas

1. **Two TypeScript configs** — type check both (`npm run type:check`)
2. **Terminal is separate** — has own `package.json`, `node_modules`, uses pnpm, port 5000
3. **Vite API plugin** — dev server handles API routes via `vite-api-plugin.ts`; production uses `server/index.ts`
4. **Husky pre-commit** — runs `lint-staged` (eslint --fix + prettier --write on `*.ts`)
5. **ESLint flat config** — config lives in `eslint.config.js` (no `.eslintrc`)
6. **Panel IDs** — must match `data-panel` attribute AND `PANEL_BY_ID` in `main.ts`
7. **Tab switching** — pure DOM show/hide, no remounting; panels persist state
8. **Plugin registration** — side-effect imports in `main.ts` lines 15-46; new plugins must be added there
9. **Docker compose** — `docker compose up app` for prod; `docker compose --profile dev up` for dev with hot reload
10. **Node version** — CI uses Node 22; setup script requires 20+

## File Locations to Know

- Plugin registry: `src/services/plugin-registry.ts`
- Plugin imports: `src/main.ts:15-46`
- API route map: `vite-api-plugin.ts:33-60`
- Panel layout/tabs: `src/main.ts:79-106`
- Refresh intervals: `src/main.ts:330-347`
- Settings keys: `src/config/settings-keys.ts`
- Preferences: `src/config/preferences.ts`
- Panel base class: `src/components/Panel.ts`
