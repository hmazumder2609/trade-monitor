# Settings Popover Fix + UX Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Fix the broken settings popover mechanism, add settings to panels that lack them, and polish the grid layout for elegant daily use.

**Architecture:** Fix the root cause (popover clipped by `overflow: hidden`), then add missing settings to 3 panels, then tune grid sizing for optimal information density.

**Tech Stack:** Vanilla TypeScript, CSS Grid, Panel base class.

---

## Root Cause Analysis

### Why settings popovers don't open

The settings popover is appended to `this.element` (the panel div) at `Panel.ts:484`. The panel has `overflow: hidden` at `main.css:274` and `contain: content` at `main.css:281`. The popover uses `position: absolute; top: 100%` (main.css:585-586), which places it below the panel header but still inside the panel's bounding box. Since `overflow: hidden` clips anything extending beyond the panel's bounds, the popover is clipped — especially for panels near the bottom of the grid or with small heights.

**Fix:** Change `toggleSettingsPopover()` to append the popover to `document.body` instead of `this.element`, and position it using `getBoundingClientRect()` relative to the gear button.

---

## Task 1: Fix settings popover clipping

**Why:** The popover is appended to the panel element which has `overflow: hidden`, causing it to be clipped. This is the root cause of settings not appearing.

**Files:**
- Modify: `src/components/Panel.ts:470-502` (toggleSettingsPopover, closeSettingsPopover)
- Modify: `src/styles/main.css:583-601` (popover CSS)

**Step 1: Update toggleSettingsPopover() in Panel.ts**

Replace the current implementation:

```ts
public toggleSettingsPopover(): void {
  if (this._settingsPopover) {
    this.closeSettingsPopover();
    return;
  }

  const content = this.getSettingsPopover();
  if (!content) return;

  this.onSettingsClick();

  this._settingsPopover = document.createElement('div');
  this._settingsPopover.className = 'panel-settings-popover';
  this._settingsPopover.appendChild(content);
  this.element.appendChild(this._settingsPopover);

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!this._settingsPopover) return;
    if (!this._settingsPopover.contains(e.target as Node) && e.target !== this._gearBtn) {
      this.closeSettingsPopover();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}
```

With:

```ts
public toggleSettingsPopover(): void {
  if (this._settingsPopover) {
    this.closeSettingsPopover();
    return;
  }

  const content = this.getSettingsPopover();
  if (!content) return;

  this.onSettingsClick();

  this._settingsPopover = document.createElement('div');
  this._settingsPopover.className = 'panel-settings-popover';
  this._settingsPopover.appendChild(content);
  document.body.appendChild(this._settingsPopover);

  // Position relative to the gear button
  const gearRect = this._gearBtn?.getBoundingClientRect();
  if (gearRect) {
    const popW = 260;
    const popH = this._settingsPopover.offsetHeight || 300;
    let left = gearRect.right - popW;
    let top = gearRect.bottom + 4;

    // Keep within viewport
    if (left < 8) left = 8;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight - 8) top = gearRect.top - popH - 4;

    this._settingsPopover.style.left = `${left}px`;
    this._settingsPopover.style.top = `${top}px`;
  }

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!this._settingsPopover) return;
    if (!this._settingsPopover.contains(e.target as Node) && e.target !== this._gearBtn) {
      this.closeSettingsPopover();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}
```

**Step 2: Update closeSettingsPopover()**

```ts
public closeSettingsPopover(): void {
  if (this._settingsPopover) {
    this._settingsPopover.remove();
    this._settingsPopover = null;
  }
}
```

(This is already correct — `remove()` works regardless of parent.)

**Step 3: Update popover CSS in main.css**

Change the popover from `position: absolute` to `position: fixed` (since it's now appended to body, not the panel):

```css
/* BEFORE */
.panel-settings-popover {
  position: absolute;
  top: 100%;
  right: 8px;
  z-index: 100;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  padding: 12px;
  min-width: 220px;
  max-width: 300px;
  animation: popover-in 0.12s ease-out;
}

/* AFTER */
.panel-settings-popover {
  position: fixed;
  z-index: 10001;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 14px;
  min-width: 240px;
  max-width: 300px;
  max-height: 70vh;
  overflow-y: auto;
  animation: popover-in 0.12s ease-out;
}
```

Key changes:
- `position: fixed` — positions relative to viewport, not parent
- `z-index: 10001` — above the modal overlay (10000)
- `max-height: 70vh; overflow-y: auto` — scrollable if content is tall
- Slightly larger padding and border-radius for elegance

**Step 4: Verify**

Run: `npm run type:check && npm run test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/components/Panel.ts src/styles/main.css
git commit -m "fix: settings popover clipped by overflow:hidden — append to body with fixed positioning"
```

---

## Task 2: Add settings to social-monitor panel

**Why:** The only visible panel with zero settings. Needs platform toggles and display options.

**Files:**
- Modify: `src/plugins/SocialMonitorPlugin/Panel.ts` (add getSettingsPopover override)

**Step 1: Add settings interface and getSettingsPopover()**

Add a settings interface and override method:

```ts
interface SocialMonitorSettings {
  platforms: { reddit: boolean; truth: boolean; x: boolean };
  minScore: number;
}

const DEFAULT_SETTINGS: SocialMonitorSettings = {
  platforms: { reddit: true, truth: true, x: true },
  minScore: 0,
};

// In the SocialMonitorPanel class:
private settings: SocialMonitorSettings;

constructor() {
  // ... existing code ...
  this.settings = this.loadSettings();
}

private loadSettings(): SocialMonitorSettings {
  try {
    const raw = localStorage.getItem('mdm-social-monitor-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

private saveSettings(): void {
  localStorage.setItem('mdm-social-monitor-settings', JSON.stringify(this.settings));
}

public getSettingsPopover(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:10px;font-size:12px;color:var(--text-primary)">Social Monitor Settings</div>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--text-secondary)">
      <input type="checkbox" id="smReddit" ${this.settings.platforms.reddit ? 'checked' : ''} />
      <span style="color:#ff4500">Reddit</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--text-secondary)">
      <input type="checkbox" id="smTruth" ${this.settings.platforms.truth ? 'checked' : ''} />
      <span style="color:#1a1a2e">Truth Social</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--text-secondary)">
      <input type="checkbox" id="smX" ${this.settings.platforms.x ? 'checked' : ''} />
      <span style="color:#1d9bf0">X / Twitter</span>
    </label>
    <div style="border-top:1px solid var(--border);margin:8px 0"></div>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--text-secondary)">
      Min score:
      <input type="number" id="smMinScore" value="${this.settings.minScore}" min="0" step="10"
        style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:12px;color:var(--text-primary)" />
    </label>
  `;

  el.querySelector('#smReddit')?.addEventListener('change', (e) => {
    this.settings.platforms.reddit = (e.target as HTMLInputElement).checked;
    this.saveSettings();
    this.renderActiveTab();
  });
  el.querySelector('#smTruth')?.addEventListener('change', (e) => {
    this.settings.platforms.truth = (e.target as HTMLInputElement).checked;
    this.saveSettings();
    this.renderActiveTab();
  });
  el.querySelector('#smX')?.addEventListener('change', (e) => {
    this.settings.platforms.x = (e.target as HTMLInputElement).checked;
    this.saveSettings();
    this.renderActiveTab();
  });
  el.querySelector('#smMinScore')?.addEventListener('change', (e) => {
    this.settings.minScore = Number((e.target as HTMLInputElement).value) || 0;
    this.saveSettings();
    this.renderActiveTab();
  });

  return el;
}
```

Also update `getFilteredPosts()` to respect platform toggles and min score:

```ts
private getFilteredPosts(): { platform: string; title: string; meta: string; score: number; url: string }[] {
  const items: { platform: string; title: string; meta: string; score: number; url: string }[] = [];
  const watchSyms = this.watchlistOnly ? getWatchlistSymbols() : null;

  if ((this.activeTab === 'all' || this.activeTab === 'reddit') && this.settings.platforms.reddit) {
    for (const p of this.data.reddit) {
      if (watchSyms && p.symbol && !watchSyms.includes(p.symbol)) continue;
      if (p.score < this.settings.minScore) continue;
      items.push({
        platform: 'reddit',
        title: p.title,
        meta: `r/${p.subreddit} · ${p.numComments} comments · ${p.author}`,
        score: p.score,
        url: p.url,
      });
    }
  }

  if ((this.activeTab === 'all' || this.activeTab === 'truth') && this.settings.platforms.truth) {
    for (const p of this.data.truth) {
      if (p.likes < this.settings.minScore) continue;
      items.push({
        platform: 'truth',
        title: p.content.slice(0, 120) + (p.content.length > 120 ? '…' : ''),
        meta: `${p.author} · ${p.likes} likes · ${p.sector || 'general'}`,
        score: p.likes,
        url: p.url,
      });
    }
  }

  if ((this.activeTab === 'all' || this.activeTab === 'x') && this.settings.platforms.x) {
    for (const p of this.data.x) {
      if (watchSyms && p.symbol && !watchSyms.includes(p.symbol)) continue;
      if (p.like_count < this.settings.minScore) continue;
      items.push({
        platform: 'x',
        title: p.text.slice(0, 120) + (p.text.length > 120 ? '…' : ''),
        meta: `@${p.author.username} · ${p.retweet_count} RTs`,
        score: p.like_count,
        url: `https://x.com/${p.author.username}/status/${p.id}`,
      });
    }
  }

  return items.sort((a, b) => b.score - a.score);
}
```

**Step 2: Verify**

Run: `npm run type:check && npm run test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/plugins/SocialMonitorPlugin/Panel.ts
git commit -m "feat: add settings popover to Social Monitor — platform toggles, min score filter"
```

---

## Task 3: Add settings to vix-gauge panel

**Why:** Returns empty div. Should have alert threshold configuration.

**Files:**
- Modify: `src/plugins/VolatilityIndexPlugin/Panel.ts` (add getSettingsPopover to VixGaugePanel)

**Step 1: Add settings to VixGaugePanel**

Add a settings interface and override method to the VixGaugePanel class:

```ts
interface VixGaugeSettings {
  elevatedThreshold: number;
  highFearThreshold: number;
}

const DEFAULT_VIX_SETTINGS: VixGaugeSettings = {
  elevatedThreshold: 20,
  highFearThreshold: 30,
};

// In VixGaugePanel class:
private settings: VixGaugeSettings;

constructor() {
  // ... existing ...
  this.settings = this.loadSettings();
}

private loadSettings(): VixGaugeSettings {
  try {
    const raw = localStorage.getItem('mdm-vix-gauge-settings');
    if (raw) return { ...DEFAULT_VIX_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VIX_SETTINGS };
}

private saveSettings(): void {
  localStorage.setItem('mdm-vix-gauge-settings', JSON.stringify(this.settings));
}

public getSettingsPopover(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:10px;font-size:12px;color:var(--text-primary)">VIX Gauge Settings</div>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--text-secondary)">
      Elevated threshold:
      <input type="number" id="vixElevated" value="${this.settings.elevatedThreshold}" min="10" max="50" step="1"
        style="width:50px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:12px;color:var(--text-primary)" />
    </label>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--text-secondary)">
      High fear threshold:
      <input type="number" id="vixHighFear" value="${this.settings.highFearThreshold}" min="15" max="80" step="1"
        style="width:50px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:12px;color:var(--text-primary)" />
    </label>
  `;

  el.querySelector('#vixElevated')?.addEventListener('change', (e) => {
    this.settings.elevatedThreshold = Number((e.target as HTMLInputElement).value) || 20;
    this.saveSettings();
    this.render();
  });
  el.querySelector('#vixHighFear')?.addEventListener('change', (e) => {
    this.settings.highFearThreshold = Number((e.target as HTMLInputElement).value) || 30;
    this.saveSettings();
    this.render();
  });

  return el;
}
```

Also update the `getStateLabel()` and `getStateColor()` methods to use `this.settings` instead of hardcoded thresholds.

**Step 2: Verify**

Run: `npm run type:check && npm run test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/plugins/VolatilityIndexPlugin/Panel.ts
git commit -m "feat: add settings to VIX Gauge — configurable fear thresholds"
```

---

## Task 4: Add settings to volatility-index panel

**Why:** Returns empty div. Should have display options.

**Files:**
- Modify: `src/plugins/VolatilityIndexPlugin/Panel.ts` (add getSettingsPopover to VolatilityIndexPanel)

**Step 1: Add settings to VolatilityIndexPanel**

```ts
interface VolIndexSettings {
  showTermStructure: boolean;
  showPercentile: boolean;
}

const DEFAULT_VOL_SETTINGS: VolIndexSettings = {
  showTermStructure: true,
  showPercentile: true,
};

// In VolatilityIndexPanel class:
private settings: VolIndexSettings;

constructor() {
  // ... existing ...
  this.settings = this.loadSettings();
}

private loadSettings(): VolIndexSettings {
  try {
    const raw = localStorage.getItem('mdm-vol-index-settings');
    if (raw) return { ...DEFAULT_VOL_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VOL_SETTINGS };
}

private saveSettings(): void {
  localStorage.setItem('mdm-vol-index-settings', JSON.stringify(this.settings));
}

public getSettingsPopover(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:10px;font-size:12px;color:var(--text-primary)">Volatility Index Settings</div>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--text-secondary)">
      <input type="checkbox" id="volTerm" ${this.settings.showTermStructure ? 'checked' : ''} />
      Show term structure
    </label>
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--text-secondary)">
      <input type="checkbox" id="volPercentile" ${this.settings.showPercentile ? 'checked' : ''} />
      Show percentile ranking
    </label>
  `;

  el.querySelector('#volTerm')?.addEventListener('change', (e) => {
    this.settings.showTermStructure = (e.target as HTMLInputElement).checked;
    this.saveSettings();
    this.render();
  });
  el.querySelector('#volPercentile')?.addEventListener('change', (e) => {
    this.settings.showPercentile = (e.target as HTMLInputElement).checked;
    this.saveSettings();
    this.render();
  });

  return el;
}
```

Also update `render()` to conditionally show/hide term structure and percentile sections based on settings.

**Step 2: Verify**

Run: `npm run type:check && npm run test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/plugins/VolatilityIndexPlugin/Panel.ts
git commit -m "feat: add settings to Volatility Index — term structure and percentile toggles"
```

---

## Task 5: Grid layout polish

**Why:** Tune grid sizing for optimal information density. Ensure panels have appropriate default sizes.

**Files:**
- Modify: `src/styles/main.css` (grid rules, panel sizing)

**Step 1: Adjust grid auto-rows for better density**

The current `grid-auto-rows: minmax(200px, 380px)` is good but could be tuned. For a financial analyst who wants density, slightly shorter default rows allow more panels visible without scrolling.

```css
/* BEFORE */
.panels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-flow: row dense;
  grid-auto-rows: minmax(200px, 380px);
  gap: 4px;
  padding: 4px;
  align-content: start;
  align-items: stretch;
}

/* AFTER */
.panels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-flow: row dense;
  grid-auto-rows: minmax(180px, 360px);
  gap: 6px;
  padding: 6px;
  align-content: start;
  align-items: stretch;
}
```

Changes:
- `minmax(280px, 1fr)` → `minmax(300px, 1fr)` — slightly wider minimum columns for better readability
- `minmax(200px, 380px)` → `minmax(180px, 360px)` — slightly shorter default rows for density
- `gap: 4px` → `gap: 6px` — slightly more breathing room between panels
- `padding: 4px` → `padding: 6px` — match gap

**Step 2: Ensure panel header has proper spacing for settings button**

Verify the panel header layout allows the gear button to be easily clickable:

```css
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  min-height: 32px;
  flex-shrink: 0;
}

.panel-settings-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.panel-settings-btn:hover {
  opacity: 1;
  background: var(--bg-hover);
}
```

**Step 3: Verify**

Run: `npm run type:check && npm run test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/styles/main.css
git commit -m "style: tune grid layout — wider columns, shorter rows, more breathing room"
```

---

## Task 6: Quality gates + final verification

**Step 1:** Run `npm run type:check` — expected: pass
**Step 2:** Run `npm run test` — expected: 63/63 pass
**Step 3:** Run `npm run format` — fix any formatting issues
**Step 4:** Commit if any fixes needed

```bash
git add -A
git commit -m "chore: final cleanup after settings and UX polish"
```

---

## Summary

| Task | What | Impact |
|------|------|--------|
| 1 | Fix popover clipping (body append + fixed position) | All settings popovers now visible |
| 2 | Social Monitor settings (platform toggles, min score) | First settings for the merged panel |
| 3 | VIX Gauge settings (fear thresholds) | Configurable alert levels |
| 4 | Volatility Index settings (term structure, percentile toggles) | Display customization |
| 5 | Grid layout polish (wider columns, shorter rows, more gap) | Better information density |
| 6 | Quality gates | Verify everything works |
