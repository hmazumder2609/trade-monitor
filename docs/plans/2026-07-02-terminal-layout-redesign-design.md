# Terminal Layout Redesign — Design Document

Date: 2026-07-02  
Status: Draft → Approved  
Author: AI + User

## Motivation

The current terminal layout distributes navigation across four different zones (TopBar, Sidebar, FunctionBar, and the TickerTape), making the workspace feel cramped and navigation indirect. The goal is to consolidate navigation into the TopBar, reclaim the full workspace width, and introduce a Spotlight-like command entry for ticker search.

## Design

### Layout (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ TopBar (single row, ~36px)                                  │
│ [←DB] [⌘] TERMINAL | MRKT SCRN WLT ALRT ECON PORT AGT |    │
│ [● MARKET] [AAPL ▼] [🔔] [clock]                            │
├─────────────────────────────────────────────────────────────┤
│ PaneGroup (full width, no sidebar)                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ TickerTape (scrolling prices, ~24px)                        │
│         ↓ moved from top to bottom                         │
├─────────────────────────────────────────────────────────────┤
│ FunctionBar (F1-F12, ~28px)                                  │
├─────────────────────────────────────────────────────────────┤
│ StatusBar (source LEDs + clock, ~24px)                       │
└─────────────────────────────────────────────────────────────┘
```

### Component Changes

#### 1. TopBar (`TopBar.tsx`) — Major rewrite

**Left group:**
| Element | Description |
|---------|-------------|
| `←DB`   | Back-to-Dashboard link with `LayoutDashboard` icon |
| `⌘`     | Terminal icon (app icon) — opens the ticker search overlay (Spotlight-style). Replaces the old text search input and the separate `/CMD` button |
| `TERMINAL` | Brand label in amber |

**Middle group (horizontal scrollable tab strip):**
Seven global-view tabs with icon + label:
| Tab    | Icon              | Label       |
|--------|-------------------|-------------|
| MRKT   | `LayoutDashboard` | MARKET      |
| SCRN   | `Filter`          | SCREENER    |
| WLT    | `Star`            | WATCHLIST   |
| ALRT   | `BellRing`        | ALERTS      |
| ECON   | `Globe2`          | ECONOMICS   |
| PORT   | `Briefcase`       | PORTFOLIO   |
| AGT    | `Bot`             | AGENT       |

- Icons rendered to the **left** of the label text
- Scrollable with a thin, elegant scrollbar (matches the existing `scrollbar-thin` utility)
- Only one active at a time — amber highlight + left border indicator

**Right group:**
| Element | Description |
|---------|-------------|
| `● MARKET` | Market status indicator (open/closed pulse dot + label, unchanged from current) |
| `ACTIVE SYMBOL ▼` | Dropdown button showing current active symbol. Clicking opens a floating menu of symbol-specific views |
| `🔔` | Bell notification icon (unchanged) |
| `clock` | Time/date display (unchanged) |

**Removed from TopBar:**
- Text search input with GO button
- Separate `/CMD` button with Zap icon
- Individual view nav buttons inline (MRKT, CHRT, NEWS, SCRN, AI, ECON, PORT) — replaced by the new tab strip

#### 2. Active Symbol Dropdown (new component)

A floating dropdown menu attached to the active symbol button in the TopBar.

**Views shown** (symbol-specific only):
| View      | Icon              | Description        |
|-----------|-------------------|--------------------|
| QUOTE     | `TrendingUp`      | Price + details    |
| CHART     | `LineChart`       | Price chart        |
| NEWS      | `Newspaper`       | News feed          |
| OPTIONS   | `CandlestickChart`| Options flow       |
| ON-CHAIN  | `Scan`            | On-chain data      |
| SENTIMENT | `MessageCircle`   | Social sentiment   |

- Each row: icon + view name + 1-line description
- Clicking navigates the active pane to that view for the current symbol
- Closes on click-outside or Escape
- Only visible when a symbol is active

#### 3. Sidebar (`Sidebar.tsx`) — Removed

All 13 items from the Sidebar are redistributed:
- 7 global views → TopBar tab strip
- 6 symbol-specific views → Active Symbol dropdown
- The Sidebar file and its imports are deleted

#### 4. TickerTape (`TickerTape.tsx`) — Moved

- Relocated from `Terminal.tsx` line ~147 (between TopBar and main content) to **below the PaneGroup**
- No functional changes — still scrolls, still clickable to set active symbol
- Makes the workspace feel less noisy at the top

#### 5. Terminal.tsx — Layout reorder

Current:
```tsx
<TopBar />
<TickerTape />
<div class="flex flex-1"> <Sidebar /> <main>...</main> </div>
<FunctionBar />
<StatusBar />
```

New:
```tsx
<TopBar />
<div class="flex flex-1"> <main>...</main> </div>
<TickerTape />
<FunctionBar />
<StatusBar />
```

#### 6. CommandBar / Search Overlay

The `⌘` (Terminal icon) in the TopBar opens the existing `CommandBar` component but with the input **pre-focused and ready for ticker entry** — like macOS Spotlight:

1. Click `⌘` or press `/` key
2. Overlay appears, focused on search input
3. Type `AAPL` → Enter → sets active symbol to AAPL, opens Quote view
4. Or type `AAPL GP` → opens Chart view for AAPL
5. Or type `MRKT` → navigates to Market view

The existing CommandBar component already supports all of this — only the trigger changes (⌘ icon instead of `/CMD` button as the primary touchpoint).

### Data Flow

```
User clicks ⌘ icon
  → setCmdOpen(true)
  → CommandBar renders
  → user types ticker [+ optional view command]
  → onExecute() fires
  → handleCommand() in Terminal.tsx sets active symbol + navigates pane

User clicks active symbol dropdown
  → dropdown renders symbol-specific view options
  → user clicks QUOTE (for example)
  → onNav("quote") navigates the active pane
```

### Icons Summary

Every navigable view gets a distinct icon:

| View Mode   | Icon                | Location                    |
|-------------|---------------------|-----------------------------|
| market      | `LayoutDashboard`   | TopBar tab strip            |
| screener    | `Filter`            | TopBar tab strip            |
| watchlist   | `Star`              | TopBar tab strip            |
| alerts      | `BellRing`          | TopBar tab strip            |
| economics   | `Globe2`            | TopBar tab strip            |
| portfolio   | `Briefcase`         | TopBar tab strip            |
| agent       | `Bot`               | TopBar tab strip            |
| quote       | `TrendingUp`        | Active symbol dropdown      |
| chart       | `LineChart`         | Active symbol dropdown      |
| news        | `Newspaper`         | Active symbol dropdown      |
| options     | `CandlestickChart`  | Active symbol dropdown      |
| onchain     | `Scan`              | Active symbol dropdown      |
| sentiment   | `MessageCircle`     | Active symbol dropdown      |

### What Stays the Same

- FunctionBar (F1-F12) — no changes
- StatusBar (source LEDs + clock) — no changes
- CommandBar component — same component, only trigger changes
- All panel components (MarketOverview, NewsPanel, etc.) — no changes
- PaneGroup, PanelGroup, workspace logic — no changes
- Theme / CSS variables — no changes

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Terminal.tsx` | Remove Sidebar + TickerTape from old positions. Add TickerTape after PaneGroup. |
| `src/components/terminal/TopBar.tsx` | Rewrite: add scrollable tab strip with icons, replace search + /CMD with terminal icon, add active symbol dropdown |
| `src/components/terminal/Sidebar.tsx` | **Delete** — views redistributed to TopBar + dropdown |
| `src/components/terminal/TickerTape.tsx` | No changes (just moved) |
| `src/components/terminal/FunctionBar.tsx` | No changes |
| `src/components/terminal/StatusBar.tsx` | No changes |
| `src/components/terminal/CommandBar.tsx` | No changes (trigger changes only) |

### Files to Create

| File | Change |
|------|--------|
| `src/components/terminal/SymbolDropdown.tsx` | New: dropdown menu for symbol-specific views |

### Implementation Order

1. TopBar rewrite — new layout, remove search/CMD, add tab strip with icons
2. SymbolDropdown component — active symbol dropdown with view options
3. Remove Sidebar + update Terminal.tsx layout
4. Move TickerTape to bottom
5. Wire ⌘ icon to open CommandBar
6. Type check + cleanup

## Acceptance Criteria

- [ ] TopBar shows 7 global view tabs with icons on the left of labels
- [ ] Active symbol dropdown shows 6 symbol-specific views with icons
- [ ] TickerTape renders below the PaneGroup
- [ ] No Sidebar visible anywhere
- [ ] ⌘ icon opens CommandBar with search input focused
- [ ] Workspace fills full width (no sidebar gap)
- [ ] Tab strip scrolls horizontally when tabs overflow, with elegant scrollbar
- [ ] `npm run type:check` passes (client + server)
