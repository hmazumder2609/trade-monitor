# Settings & Config Architecture — Design

## Overview

Three-part initiative: (1) add JSON import/export of all panel/app settings, (2) make per-panel refresh intervals configurable via settings popover, (3) integrate Terminal's cyan/gold design language into trade-monitor's settings UI.

## B1 — JSON Import/Export

### New SettingsModal Tab
- Add a 6th tab labeled "Import/Export" to the SettingsModal
- Tab shows two sections: **Export** (one button) and **Import** (file picker + button)

### Settings Registry
Create a single registry of all known localStorage keys in a new file `src/services/settings-registry.ts`:

```ts
export const SETTINGS_KEYS = {
  preferences: 'mdm-preferences-v1',
  secrets: 'mdm-secrets-v1',
  panelSpans: 'mdm-panel-spans',
  panelColSpans: 'mdm-panel-col-spans',
  panelOrder: 'mdm-panel-order',
  customPanels: 'mdm-custom-panels',
  activeTab: 'mdm-active-tab',
  refreshOverrides: 'mdm-refresh-overrides',
  financialNewsSources: 'mdm-financial-news-sources',
  financialNewsFilters: 'mdm-financial-news-filters',
  socialSentimentAccounts: 'mdm-social-sentiment-accounts',
  // Future panel settings added here
} as const;
```

### Export Behavior
- Collect values for all known keys via `localStorage.getItem()`
- Package into `{ version: 1, exportedAt: ISO string, data: Record<string, any> }`
- Trigger download via `<a download="trade-monitor-settings.json">`

### Import Behavior
- File input → `FileReader.readAsText()` → JSON parse → validate structure (has `data` object, `version` number)
- Confirm dialog showing key count
- Batch write all keys to localStorage
- Show "Reload page to apply?" prompt with reload button

## B2 — Configurable Per-Panel Refresh Intervals

### Storage
New localStorage key: `mdm-refresh-overrides: Record<string, number>`
- Keyed by panel ID, value in milliseconds

### Panel Base Class Change (`src/components/Panel.ts`)
In `toggleSettingsPopover()`, after appending the refresh info row:
- If `_refreshIntervalMs > 0`, add a number input labeled "Refresh interval (minutes)"
- Pre-fill from override in localStorage (or fall back to `_refreshIntervalMs / 60000`)
- On change: save to `mdm-refresh-overrides` + dispatch custom event `mdm-refresh-interval-changed` with `{ panelId, intervalMs }`

### Scheduler Change (`src/services/refresh-scheduler.ts`)
Add method:
```ts
public updateInterval(name: string, newIntervalMs: number): void
```
- Clears existing timer for `name`
- Updates `RunnerEntry.intervalMs`
- Creates new timer with `newIntervalMs`
- Resets backoff state

### Registry Change (`src/services/plugin-registry.ts`)
In `getRefreshTasks()`, after building base tasks:
- Read `mdm-refresh-overrides` from localStorage
- If override exists for a given plugin ID, use it instead of `refreshIntervalMs`

### Wiring (`src/main.ts`)
- Listen for `mdm-refresh-interval-changed` event
- Call `scheduler.updateInterval(panelId, intervalMs)`

## Design Integration (Terminal Theme → trade-monitor)

### CSS Variable Mapping
Replace trade-monitor's current hardcoded hex values in `src/styles/main.css` with Terminal's HSL-based variables:

| trade-monitor current | New value | Notes |
|---|---|---|
| `--bg: #0a0a0a` | `--background: 0 0% 5%` | Match Terminal dark |
| `--bg-secondary: #111` | `--bg-secondary: 0 0% 6%` | Match sidebar |
| `--surface: #141414` | `--surface: 0 0% 7%` | Match card |
| `--surface-hover: #1e1e1e` | `--surface-hover: 0 0% 9%` | |
| `--surface-active: #1a1a2e` | `--surface-active: 0 0% 10%` | |
| `--bg-elevated: #1a1a1a` | `--bg-elevated: 0 0% 8%` | Match popover |
| `--border: #2a2a2a` | `--border: 0 0% 14%` | Match Terminal border |
| `--border-strong: #444` | `--border-strong: 0 0% 18%` | |
| `--border-subtle: #1a1a1a` | `--border-subtle: 0 0% 11%` | |
| `--text: #e0e0e0` | `--text: 40 10% 85%` | Match foreground |
| `--text-secondary: #ccc` | `--text-secondary: 30 5% 75%` | |
| `--text-dim: #888` | `--text-dim: 30 5% 60%` | |
| `--text-muted: #666` | `--text-muted: 30 5% 52%` | Match muted-foreground |
| `--accent: #fff` | `--accent: 186 45% 50%` | Replaced by cyan primary |
| (new) | `--primary: 186 45% 50%` | Cyan — replaces accent as main brand |
| (new) | `--primary-foreground: 0 0% 5%` | |
| (new) | `--gold: 38 30% 50%` | Gold secondary accent |

Terminal's `--cyan` variable appears swapped — `--amber: 186 45% 50%` and `--cyan: 38 30% 50%` in Terminal's CSS (line 53-54) appear to have labels reversed. Use `--primary: 186 45% 50%` (cyan) as the main accent, matching the intended "cyan & black" theme.

### Specific UI Updates

**Settings popover** (`src/styles/main.css` lines 796-809):
- `background: hsl(var(--bg-elevated))` → `background: hsl(0 0% 8%)` (match Terminal --popover)
- `border-color: hsl(var(--border))` → use Terminal's `--popover-border`

**Settings form inputs** (lines 6696-6716):
- Focus border: `var(--blue)` → `hsl(var(--primary))` (cyan)
- Focus shadow: `rgba(59,130,246,0.25)` → `hsla(186, 45%, 50%, 0.25)`

**Settings form buttons** (lines 6821-6834):
- `.settings-form-btn` background: `var(--accent)` no longer white — use `hsl(var(--primary))` with `var(--primary-foreground)` text
- Hover: `opacity: 0.85` (consistent with .trading-submit-btn)

**Trading buttons** (lines 5374-5435):
- `.trading-submit-btn`: `background: var(--green)` → `background: hsl(var(--primary))` (cyan)
- `.trading-btn-outline:hover`: `border-color: hsl(var(--gold))` (gold accent)

**Scrollbar** (line 468):
- `.panel-content::-webkit-scrollbar-thumb`: `background: hsl(var(--border))`

**Toggles** (lines 6718-6761):
- `.settings-form-toggle input:checked + .settings-form-toggle-slider`: `background: hsl(var(--primary))`

### Light Theme (happy-theme.css)
The Terminal is always-dark, so the light theme (`happy-theme.css`) stays as-is for now. The design integration only affects dark mode. If light mode is kept, its variables remain unchanged.

## No Per-Plugin Code Changes Required
- B1 is purely SettingsModal + settings-registry.ts (no plugin changes)
- B2 is Panel base class + scheduler + registry (zero plugin changes)
- Design integration is CSS-only (no plugin changes)
