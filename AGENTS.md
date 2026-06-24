# AGENTS.md — trade-monitor

## Quick Commands

| Task                        | Command                                |
| --------------------------- | -------------------------------------- |
| Install deps                | `npm install`                          |
| Install terminal deps       | `npm run install:terminal`             |
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
| Format check (TS only)      | `npm run format:check`                 |
| Format write (TS only)      | `npm run format`                       |
| Test (run once)             | `npm run test`                         |
| Test (watch)                | `npm run test:watch`                   |
| Test coverage               | `npm run test:coverage`                |
| Build (client)              | `npm run build`                        |
| Build (server)              | `tsc -p tsconfig.server.json`          |
| Build (terminal)            | `npm run build:terminal`               |
| Build all                   | `npm run build:all`                    |
| Start prod server           | `npm run start`                        |
| Run single test             | `npx vitest run tests/server.test.ts`  |

`npm run build` runs `tsc && vite build` — type-check then bundle.

## Architecture

Three separate codebases in one repo:

### Main dashboard (`src/`) — Vanilla TS + Vite
- `plugins/` — **Plugin system**: each panel self-registers via `registry.register()` + side-effect import in `main.ts:16-46` (31 plugins)
- `components/` — Panel classes (extend `Panel.ts` base)
- `services/` — Data fetching (pure functions, `fetchX()` naming)
- `config/` — Settings keys & preferences
- `utils/` — Helpers (circuit breaker, sparkline, formatting, theme)
- `agents/` — Trading agent (position-manager, executor)
- `main.ts` — Entry: plugin registration, panel instantiation, 7 tabs, refresh scheduler, alert monitoring auto-start

### API server (`server/`) — Express
- `routes/` — 25 API endpoints; same handlers used by both Vite dev plugin and standalone server
- `index.ts` — Standalone server (port 3000) with auth middleware, terminal bridge, SPA fallback
- `logger.ts`, `auth.ts` — Middleware

### Terminal subproject (`src/terminal/`) — React + Vite + Express
- **Completely separate**: own `package.json`, `node_modules`, `vite.config.ts`
- PostgreSQL via drizzle-orm, Remotion for video rendering
- Runs on port 5000; in production served at `/terminal` by the Express server
- Uses tsx for running TypeScript server directly

## Key Conventions

- **Path alias**: `@/` → `src/`
- **Plugin pattern**: Each plugin in `src/plugins/` self-registers via `registry.register()` in its `plugin.ts`; must also add a side-effect import in `src/main.ts:16-46`
- **Panel base**: All panels extend `Panel.ts` (loading/error states, mount/destroy, settings popover)
- **API routes**: Embedded in Vite dev via `vite-api-plugin.ts` (routes map lines 33-55); production uses `server/index.ts` — same handler functions, just different wiring
- **Theme**: Dark/light via `theme-manager.ts`, applied in `index.html` inline script (flash-free)
- **Settings**: Stored in localStorage, managed via `services/settings-store.ts`
- **Refresh**: `RefreshScheduler` registers named tasks with intervals (visibility-aware)
- **Alert triggers**: Automated monitoring via `alert-triggers.ts` (sentiment, keyword, price, cross-panel signals)
- **Layout mode**: `PanelMode = 'monitoring' | 'research'` — Cmd/Ctrl+Shift+R toggles

## Testing

- **Framework**: Vitest (node environment) for `tests/**/*.test.ts`
- **Terminal tests**: `src/terminal/server/*.test.ts` and `src/terminal/client/src/lib/*.test.ts` — use **Node test runner** (`node --test`), **not** Vitest
- **Coverage thresholds**: lines/functions 50%, branches 40%

## TypeScript

- **Client**: `tsconfig.json` — strict, bundler resolution, noEmit, DOM libs; excludes `src/terminal`
- **Server**: `tsconfig.server.json` — outputs to `dist-server/`, Node libs only
- **Terminal**: `src/terminal/tsconfig.json` — separate config
- **Always check both**: `npm run type:check` or `npx tsc --noEmit && tsc -p tsconfig.server.json --noEmit`

## Setup

- Quick start: `./scripts/setup.sh` (auto-installs, prompts for API keys, starts dev)
- One-shot: `./scripts/setup.sh --quick` (skip prompts)
- Production: `./scripts/setup.sh --prod` (build Docker image + run container)
- Manual: `cp .env.example .env` → fill keys → `npm ci` → `npm run dev`

## Environment / Ports

API keys configured via Settings modal in the browser (stored in localStorage, synced to `.env`). Required keys: `FINNHUB_API_KEY`, `GITHUB_PAT`, `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`, `FRED_API_KEY`, `FEISHU_APP_ID`, `OPENROUTER_API_KEY`. See Settings → API Keys for test buttons.

- Vite dev server: `5173`
- Express API server: `3000` (or `PORT` env)
- Terminal dev server: `5000`

## Quality Gates

No CI workflow is configured yet (no `.github/workflows/`). Before landing changes, manually verify:
1. Type check both configs: `npm run type:check`
2. Lint: `npm run lint`
3. Format check: `npm run format:check`
4. Test + coverage: `npm run test:coverage`

## Common Gotchas

1. **Two TypeScript configs** — always check both with `npm run type:check`
2. **Terminal is separate** — own `package.json`, own `node_modules`, port 5000; install with `npm run install:terminal`
3. **Vite API plugin** — dev server handles API routes via `vite-api-plugin.ts`; production uses `server/index.ts`
4. **ESLint flat config** — `eslint.config.js` (no `.eslintrc`)
5. **Panel IDs** — must match `data-panel` attribute AND the plugin's `id` field in `registry.register()`
6. **Tab switching** — pure DOM show/hide, no remounting; panels persist state
7. **Plugin registration** — side-effect imports in `src/main.ts:16-46`; new plugins **must** be added there
8. **Format only covers `.ts`** — `npm run format` only prettifies `src/**/*.ts`, `server/**/*.ts`, `tests/**/*.ts`; other file types are not auto-formatted
9. **Docker compose** — `docker compose up app` for prod; `docker compose --profile dev up` for dev with hot reload
10. **Node version** — requires Node 20+
11. **Husky** — `package.json` has `"prepare": "husky"` but no `.husky/` directory checked in; hooks need to be initialized with `npx husky init`
12. **`build` runs `tsc`** — `npm run build` type-checks first via `tsc && vite build`
