# Settings & Config Architecture — Implementation Plan

> **For Claude:** Use delegated-execution to implement this plan task-by-task.

**Goal:** Add JSON import/export of all settings, make per-panel refresh intervals configurable, and integrate Terminal's cyan/gold design language into trade-monitor settings UI.

**Architecture:** Settings stored in localStorage under `mdm-*` keys; a new `settings-registry.ts` centralizes all known keys. A 6th "Import/Export" tab in SettingsModal handles bulk export/import. Panel base class auto-appends a refresh interval override field in the settings popover. CSS variables in `main.css` are remapped to Terminal's HSL-based dark palette.

**Tech Stack:** Vanilla TypeScript, DOM APIs, localStorage, CSS custom properties.

---

### Task 1: Create settings-registry.ts

**Files:**
- Create: `src/services/settings-registry.ts`

**Step 1: Write the registry file**

```ts
/**
 * Central registry of all known localStorage keys used by panels and the app.
 * Single source of truth for import/export and key discovery.
 */

export const SETTINGS_KEYS = {
  /** Global preferences (UserPreferences interface) */
  preferences: 'mdm-preferences-v1',
  /** API keys / secrets (encrypted at rest by browser) */
  secrets: 'mdm-secrets-v1',
  /** Panel row height overrides */
  panelSpans: 'mdm-panel-spans',
  /** Panel column width overrides */
  panelColSpans: 'mdm-panel-col-spans',
  /** Panel order within each grid */
  panelOrder: 'mdm-panel-order',
  /** Custom iframe/API panels */
  customPanels: 'mdm-custom-panels',
  /** Last active tab */
  activeTab: 'mdm-active-tab',
  /** Per-panel refresh interval overrides (panelId → ms) */
  refreshOverrides: 'mdm-refresh-overrides',
  /** FinancialNewsPlugin: RSS source list */
  financialNewsSources: 'mdm-financial-news-sources',
  /** FinancialNewsPlugin: filter state */
  financialNewsFilters: 'mdm-financial-news-filters',
  /** SocialSentimentPlugin: tracked accounts */
  socialSentimentAccounts: 'mdm-social-sentiment-accounts',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export const ALL_SETTINGS_KEYS: string[] = Object.values(SETTINGS_KEYS);

/** Export format version — bump on breaking schema changes */
export const EXPORT_FORMAT_VERSION = 1;

export interface SettingsExport {
  version: number;
  exportedAt: string;
  data: Record<string, string | null>;
}

export function exportAllSettings(): SettingsExport {
  const data: Record<string, string | null> = {};
  for (const key of ALL_SETTINGS_KEYS) {
    try {
      data[key] = localStorage.getItem(key);
    } catch {
      data[key] = null;
    }
  }
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function importSettings(exportData: SettingsExport): { imported: number; failed: number } {
  let imported = 0;
  let failed = 0;
  if (!exportData || typeof exportData !== 'object' || !exportData.data) {
    return { imported: 0, failed: 0 };
  }
  for (const [key, value] of Object.entries(exportData.data)) {
    if (!ALL_SETTINGS_KEYS.includes(key)) continue;
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
      imported++;
    } catch {
      failed++;
    }
  }
  return { imported, failed };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/services/settings-registry.ts
git commit -m "feat(settings): add central settings registry for import/export"
```

---

### Task 2: Add import/export tab to SettingsModal

**Files:**
- Modify: `src/components/SettingsModal.ts`

**Step 1: Read the current SettingsModal end**

Read lines 1000-1187 of SettingsModal.ts to understand where to add the new tab.

**Step 2: Add the Import/Export tab**

In the `openSettings()` function, after the existing 5 tab panes, add:
```html
<div id="settingsImportExport" style="display:none"></div>
```

Add a 6th tab button in the settings-tabs area.

**Step 3: Render the Import/Export pane**

Create a `renderImportExportTab()` function that:
- **Export section**: Button "Export All Settings" → calls `exportAllSettings()` → `JSON.stringify(pretty)` → `<a download="trade-monitor-settings-{date}.json">` click to download
- **Import section**: Hidden `<input type="file" accept=".json">` + "Import Settings" button
- On file select: `FileReader.readAsText()` → JSON parse → `importSettings()` → show result count → "Reload" button

**Step 4: Wire tab switching**

Add the import/export tab to the `tabIds` array so it responds to tab clicks.

**Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/SettingsModal.ts
git commit -m "feat(settings): add import/export tab to SettingsModal"
```

---

### Task 3: Add updateInterval method to RefreshScheduler

**Files:**
- Modify: `src/services/refresh-scheduler.ts`

**Step 1: Add the updateInterval method**

Add to the `RefreshScheduler` class:

```ts
/**
 * Update the refresh interval for a running task.
 * Clears existing timer and creates a new one with the new interval.
 * Resets backoff state on the new schedule.
 */
public updateInterval(name: string, newIntervalMs: number): void {
  const entry = this.runners.get(name);
  if (!entry) return;
  entry.intervalMs = newIntervalMs;
  entry.consecutiveFailures = 0;
  entry.currentBackoffMultiplier = 1;
  if (!document.hidden) {
    this.scheduleNextRun(name, entry);
  }
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/services/refresh-scheduler.ts
git commit -m "feat(scheduler): add updateInterval method for dynamic rescheduling"
```

---

### Task 4: Add refresh interval override field to Panel base class

**Files:**
- Modify: `src/components/Panel.ts`

**Step 1: Add import and constants**

Add at top of file:
```ts
import { SETTINGS_KEYS } from '@/services/settings-registry';
```

Add a constant:
```ts
const REFRESH_OVERRIDES_KEY = SETTINGS_KEYS.refreshOverrides;
```

**Step 2: Add helper methods**

```ts
private loadRefreshOverride(): number | null {
  try {
    const raw = localStorage.getItem(REFRESH_OVERRIDES_KEY);
    if (!raw) return null;
    const overrides = JSON.parse(raw) as Record<string, number>;
    return overrides[this.panelId] ?? null;
  } catch {
    return null;
  }
}

private saveRefreshOverride(ms: number): void {
  try {
    const raw = localStorage.getItem(REFRESH_OVERRIDES_KEY);
    const overrides: Record<string, number> = raw ? JSON.parse(raw) : {};
    overrides[this.panelId] = ms;
    localStorage.setItem(REFRESH_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage unavailable — skip
  }
  window.dispatchEvent(
    new CustomEvent('mdm-refresh-interval-changed', {
      detail: { panelId: this.panelId, intervalMs: ms },
    })
  );
}
```

**Step 3: Modify `toggleSettingsPopover()` to append interval field**

After the existing refresh info row (lines 552-557), append a number input when `_refreshIntervalMs > 0`:

```ts
// Configurable refresh interval
if (this._refreshIntervalMs > 0) {
  const intervalRow = document.createElement('div');
  intervalRow.className = 'settings-form-row';
  intervalRow.style.marginTop = '8px';

  const label = document.createElement('label');
  label.className = 'settings-form-label';
  label.textContent = 'Refresh (min)';
  label.style.flex = 'none';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'settings-form-input';
  input.min = '1';
  input.max = '120';
  input.step = '1';
  input.style.width = '70px';
  input.style.flex = 'none';

  const override = this.loadRefreshOverride();
  input.value = String((override ?? this._refreshIntervalMs) / 60_000);

  input.addEventListener('change', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 1) {
      input.value = String(this._refreshIntervalMs / 60_000);
      return;
    }
    this.saveRefreshOverride(val * 60_000);
  });

  intervalRow.append(label, input);
  this._settingsPopover.appendChild(intervalRow);
}
```

**Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/Panel.ts
git commit -m "feat(panel): add configurable refresh interval to settings popover"
```

---

### Task 5: Wire configurable intervals in plugin-registry + main.ts

**Files:**
- Modify: `src/services/plugin-registry.ts`
- Modify: `src/main.ts`

**Step 1: Modify plugin-registry.ts — read overrides in getRefreshTasks()**

At the top of the file, add:
```ts
const REFRESH_OVERRIDES_KEY = 'mdm-refresh-overrides';
```

In `getRefreshTasks()`, after building each task, check for an override:
```ts
getRefreshTasks(): RefreshRegistration[] {
  // Read overrides from localStorage once
  let overrides: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(REFRESH_OVERRIDES_KEY);
    if (raw) overrides = JSON.parse(raw);
  } catch {}

  const tasks: RefreshRegistration[] = [];
  for (const m of this.plugins.values()) {
    let intervalMs = m.refreshIntervalMs;
    if (!intervalMs) continue;

    // Apply override if present
    if (overrides[m.id] != null && overrides[m.id] > 0) {
      intervalMs = overrides[m.id];
    }

    // Build tasks using intervalMs...
    // (rest of existing code, using the local `intervalMs` instead of `m.refreshIntervalMs`)
  }
  return tasks;
}
```

**Step 2: Modify main.ts — listen for interval change events**

After the scheduler initialization (around line 361), add:

```ts
// Listen for per-panel refresh interval changes
window.addEventListener('mdm-refresh-interval-changed', ((e: CustomEvent<{ panelId: string; intervalMs: number }>) => {
  const { panelId, intervalMs } = e.detail;
  scheduler.updateInterval(panelId, intervalMs);
}) as EventListener);
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/services/plugin-registry.ts src/main.ts
git commit -m "feat(settings): wire configurable refresh intervals from localStorage to scheduler"
```

---

### Task 6: Design integration — update CSS variables in main.css

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Read the current CSS variable declarations**

Read lines 1-100 of main.css to see the current `:root` and `.dark` variable blocks.

**Step 2: Replace dark theme variables with Terminal HSL equivalents**

Update the dark-mode `:root` section (the first `--bg: #0a0a0a` block and the `.dark` block) to use Terminal's palette:

```css
:root {
  --bg: hsl(0 0% 5%);
  --background: 0 0% 5%;
  --bg-secondary: hsl(0 0% 6%);
  --surface: hsl(0 0% 7%);
  --surface-hover: hsl(0 0% 9%);
  --surface-active: hsl(0 0% 10%);
  --bg-elevated: hsl(0 0% 8%);
  --border: hsl(0 0% 14%);
  --border-strong: hsl(0 0% 18%);
  --border-subtle: hsl(0 0% 11%);
  --text: hsl(40 10% 85%);
  --text-secondary: hsl(30 5% 75%);
  --text-dim: hsl(30 5% 60%);
  --text-muted: hsl(30 5% 52%);
  --text-faint: hsl(30 5% 40%);
  --text-ghost: hsl(30 5% 30%);
  --accent: hsl(186 45% 50%);        /* cyan — replaces old white accent */
  --primary: 186 45% 50%;            /* HSL parts for use with hsla/hsl */
  --gold: 38 30% 50%;                /* gold secondary */
  --green: hsl(142 60% 42%);
  --red: hsl(0 65% 48%);
  --yellow: hsl(45 80% 50%);
  --blue: hsl(210 80% 55%);

  /* Keep existing derived variables */
  --overlay-light: hsla(0 0% 100% / 0.06);
  --overlay-medium: hsla(0 0% 100% / 0.1);
  --overlay-subtle: hsla(0 0% 100% / 0.03);

  /* etc... */
}
```

**Step 3: Keep the light theme (happy-theme.css) variables unchanged**

**Step 4: Verify no visual breakage**

Run: `npm run dev` and visually check the dashboard loads without missing styles.

**Step 5: Commit**

```bash
git add src/styles/main.css
git commit -m "style: migrate dark CSS variables to Terminal HSL palette"
```

---

### Task 7: Design integration — update settings form CSS

**Files:**
- Modify: `src/styles/main.css` (settings-form sections + panel-settings-popover sections)

**Step 1: Update settings popover styling**

Around line 796-809, update `.panel-settings-popover`:
- `background: hsl(0 0% 8%)` — match Terminal's --popover
- Keep `border: 1px solid var(--border)` (already uses var)

**Step 2: Update focus styles to use cyan**

Around line 6710-6716, change:
```css
.settings-form-input:focus,
.settings-form-select:focus,
.settings-form-textarea:focus {
  outline: none;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 1px hsla(var(--primary), 0.25);
}
```

**Step 3: Update toggle checked state**

Around line 6754:
```css
.settings-form-toggle input:checked + .settings-form-toggle-slider {
  background: hsl(var(--primary));
}
```

**Step 4: Update settings-form-btn**

Around line 6821-6834:
```css
.settings-form-btn {
  background: hsl(var(--primary));
  color: hsl(0 0% 5%);
  /* ... rest unchanged ... */
}
.settings-form-btn:hover {
  opacity: 0.85;
}
```

**Step 5: Update trading buttons (if they reference old green)**

Around line 5424-5434:
```css
.trading-submit-btn {
  background: hsl(var(--primary));
  color: hsl(0 0% 5%);
  /* ... rest unchanged ... */
}
```

**Step 6: Update panel-settings-popover toggle to use primary**

Around line 899:
```css
.panel-settings-popover .settings-toggle:checked {
  background: hsl(var(--primary));
}
```

**Step 7: Verify compilation**

Run: `npx tsc --noEmit` (CSS-only change, should still pass)

**Step 8: Commit**

```bash
git add src/styles/main.css
git commit -m "style: update settings UI to use cyan primary and gold accent"
```

---

### Task 8: Final verification

**Files:** All modified files

**Step 1: Full type check**

Run: `npm run type:check`
Expected: No errors

**Step 2: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Quick smoke test**

Run: `npm run dev` and verify:
1. Settings gear button opens popover with refresh interval field
2. Changing interval triggers `mdm-refresh-interval-changed` event
3. SettingsModal shows 6 tabs including "Import/Export"
4. Export downloads a JSON file
5. Import accepts a JSON file and writes to localStorage
6. UI uses cyan accents in focus states, toggles, and buttons

**Step 4: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address review feedback on settings config"
```
