# Terminal Layout Redesign — Implementation Plan

> **For Claude:** Use task-runner or delegated-execution to implement this plan task-by-task.

**Goal:** Consolidate navigation into the TopBar, remove Sidebar, move TickerTape to bottom, add Spotlight-style command entry, add active symbol dropdown for symbol-specific views.

**Architecture:** Single-row TopBar with scrollable tab strip (7 global views), active symbol dropdown (6 symbol-specific views), terminal icon for command overlay. Sidebar removed. TickerTape relocated below PaneGroup.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, @tanstack/react-query

---

### Task 1: Rewrite TopBar

**Files:**
- Modify: `trade-monitor/src/terminal/client/src/components/terminal/TopBar.tsx`

**Changes:**
- Replace search form + GO button with a single Terminal icon (from lucide-react: `Terminal` or `Command`) that calls `onOpenCmd`
- Remove `/CMD` button (merged into the terminal icon)
- Add horizontal scrollable tab strip for 7 global views, each with icon + label
- Keep: back-to-dashboard, brand, market status, active symbol button, bell, clock
- Tab strip icons: MRKT→`LayoutDashboard`, SCRN→`Filter`, WLT→`Star`, ALRT→`BellRing`, ECON→`Globe2`, PORT→`Briefcase`, AGT→`Bot`
- Active tab highlight: amber bottom border + bg tint

Key imports to add: All lucide icons for the tabs.

**Verify:**
- `npm run type:check` passes

---

### Task 2: Create SymbolDropdown Component

**Files:**
- Create: `trade-monitor/src/terminal/client/src/components/terminal/SymbolDropdown.tsx`

**Component:**
```tsx
import { TrendingUp, LineChart, Newspaper, CandlestickChart, Scan, MessageCircle } from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  symbol: string;
  onNav: (view: ViewMode) => void;
  onClose: () => void;
}

const SYMBOL_VIEWS: Array<{ view: ViewMode; icon: typeof TrendingUp; label: string; desc: string }> = [
  { view: "quote",    icon: TrendingUp,      label: "QUOTE",     desc: "Price summary" },
  { view: "chart",    icon: LineChart,       label: "CHART",     desc: "Technical analysis" },
  { view: "news",     icon: Newspaper,       label: "NEWS",      desc: "Headlines & articles" },
  { view: "options",  icon: CandlestickChart, label: "OPTIONS",   desc: "Options flow" },
  { view: "onchain",  icon: Scan,            label: "ON-CHAIN",  desc: "Blockchain data" },
  { view: "sentiment",icon: MessageCircle,   label: "SENTIMENT", desc: "Social sentiment" },
];
```

- Renders as a floating dropdown panel below the active symbol button
- Click-outside / Escape closes
- Each row: icon (left) + label + description (right)
- onClick navigates the active pane + closes

**Verify:**
- `npm run type:check` passes

---

### Task 3: Remove Sidebar + Update Terminal.tsx

**Files:**
- Modify: `trade-monitor/src/terminal/client/src/pages/Terminal.tsx`
- Delete: `trade-monitor/src/terminal/client/src/components/terminal/Sidebar.tsx`

**Changes in Terminal.tsx:**
1. Remove `import Sidebar from "@/components/terminal/Sidebar"`
2. Remove `<Sidebar />` JSX
3. Move `<TickerTape />` from between TopBar and content to **after** the main content div (before FunctionBar)
4. Change `<div className="flex flex-1 overflow-hidden">` to a simple wrapper (no sidebar flex)
5. Remove `sidebar` classes from layout wrapper

New layout structure:
```tsx
<div className="flex flex-col h-screen bg-background overflow-hidden">
  <TopBar ... />
  <div className="flex-1 overflow-hidden bg-background">
    {workspace.secondary ? (
      <PanelGroup>...</PanelGroup>
    ) : (
      <WorkspacePane>...</WorkspacePane>
    )}
  </div>
  <TickerTape onSymbol={handleSymbol} />
  <FunctionBar ... />
  <StatusBar />
</div>
```

**Delete Sidebar.tsx** — the file is no longer referenced anywhere.

**Verify:**
- `npm run type:check` passes (client side only)
- Confirm no remaining imports of Sidebar anywhere

---

### Task 4: Wire Terminal Icon to CommandBar + Symbol Dropdown State

**Files:**
- Modify: `trade-monitor/src/terminal/client/src/pages/Terminal.tsx` (already open from Task 3)

**Changes:**
- Add state: `const [symbolDropdownOpen, setSymbolDropdownOpen] = useState(false);`
- The TopBar's active symbol button click toggles `symbolDropdownOpen`
- Pass `onSymbolDropdownToggle` and `symbolDropdownOpen` to TopBar
- Render `<SymbolDropdown />` conditionally when `symbolDropdownOpen`
- `/` key shortcut continues to open CommandBar (unchanged)
- ⌘ (Terminal) icon in TopBar calls `onOpenCmd` which opens CommandBar

**Props flow:**
```
Terminal.tsx:
  TopBar:
    onOpenCmd → setCmdOpen(true)
    <SymbolDropdown> managed by state in Terminal.tsx
```

**Verify:**
- `npm run type:check` passes

---

### Task 5: Update TopBar to Accept Dropdown Props

**Files:**
- Modify: `trade-monitor/src/terminal/client/src/components/terminal/TopBar.tsx` (already open from Task 1)

**Changes:**
- Add `onToggleSymbolDropdown: () => void` prop
- Active symbol button onClick → calls `onToggleSymbolDropdown`
- Add a small chevron icon (▼) next to the symbol text

**Interface update:**
```tsx
interface Props {
  activeSymbol: string;
  view: ViewMode;
  onNav: (v: ViewMode) => void;
  onSymbol: (sym: string) => void;
  onOpenCmd: () => void;
  onToggleSymbolDropdown: () => void;
}
```

**Verify:**
- `npm run type:check` passes

---

### Task 6: Final Verification

**Run all checks:**
```bash
cd trade-monitor
.\node_modules\.bin\tsc --noEmit --pretty
.\node_modules\.bin\tsc -p tsconfig.server.json --noEmit --pretty
```

- No TypeScript errors
- Confirm Sidebar.tsx is deleted
- Confirm layout renders correctly in dev

---

### Files Summary

| Action | File |
|--------|------|
| Modify | `trade-monitor/src/terminal/client/src/components/terminal/TopBar.tsx` |
| Create | `trade-monitor/src/terminal/client/src/components/terminal/SymbolDropdown.tsx` |
| Modify | `trade-monitor/src/terminal/client/src/pages/Terminal.tsx` |
| Delete | `trade-monitor/src/terminal/client/src/components/terminal/Sidebar.tsx` |
| Unchanged | `trade-monitor/src/terminal/client/src/components/terminal/TickerTape.tsx` |
| Unchanged | `trade-monitor/src/terminal/client/src/components/terminal/FunctionBar.tsx` |
| Unchanged | `trade-monitor/src/terminal/client/src/components/terminal/StatusBar.tsx` |
| Unchanged | `trade-monitor/src/terminal/client/src/components/terminal/CommandBar.tsx` |
