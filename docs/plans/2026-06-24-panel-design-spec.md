# Panel Design Specification

> Visual design descriptions for every panel, written for an expert financial analyst using the system daily. Each description covers what the panel should look like as a polished, professional tool.

---

## Design Principles

1. **Information density first** — An expert doesn't need hand-holding. Show the data, minimize chrome.
2. **Color = meaning** — Green/red for up/down, warm colors for danger, cool for calm. Never decorative.
3. **Consistent rhythm** — All panels use the same spacing, typography, and card patterns.
4. **Progressive disclosure** — Summary first, details on hover/click. Don't overwhelm.
5. **Dark mode native** — Designed for dark backgrounds. Light mode is an inversion, not a separate design.

---

## DASHBOARD TAB

### 1. VIX Fear Gauge (`vix-gauge`)

**What it is:** A single-row ticker strip — the market's pulse at a glance.

**Layout:** Horizontal flex row, two columns. Left: label + price. Right: change + fear state.

```
┌──────────────────────────────────────────────────┐
│  VIX                              ▲ 2.34 (+8.2%) │
│  28.47  ████████████████████░░░░  High Fear       │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Left column:** "VIX" in 10px uppercase letter-spaced muted text. Below it, the price in 24px bold — color shifts from green (low) → amber (elevated) → red (high fear) based on configurable thresholds.
- **Right column:** Change arrow + value + percent in 13px, color-coded (green for down, red for up). Below it, the fear state label in 11px muted text.
- **Progress bar** (optional): A thin 4px horizontal bar between the two columns showing VIX position within its 0-80 range. Filled portion color-matches the fear state.
- **Hover:** Tooltip shows "52w range: 12.4 — 45.7" and percentile rank.

**Height:** Compact — fills one row (~50px). No internal scrolling.

---

### 2. Weather (`weather`)

**What it is:** Ambient awareness — current conditions + forecast without leaving the dashboard.

**Layout:** Three stacked sections: dual clocks, current conditions, forecast strip.

```
┌──────────────────────────────────────────────────┐
│  🕐 New York  14:32:07     🌐 AoE  02:32:07     │
│            Wed, Jun 24         Tue, Jun 24       │
├──────────────────────────────────────────────────┤
│  ☀️  72°F          Feels 70°F  💧 45%  💨 8mph  │
│      Clear · New York                             │
├──────────────────────────────────────────────────┤
│  Thu     Fri     Sat     Sun                     │
│  ☀️      🌤️      🌧️      ☀️                     │
│  74/58   71/60   65/55   73/59                   │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Clocks row:** Two live clocks (local + AoE/UTC-12) side by side. Each shows city label (10px muted), time (16px monospace), date (10px muted). Time updates every second.
- **Current conditions:** Large weather emoji (32px), temperature in 28px bold, description + city in 12px muted. Right-aligned: feels like, humidity (droplet icon), wind (wind icon) in 11px.
- **Forecast strip:** 4-day horizontal row. Each day: day name (10px), emoji (20px), hi/lo temps (11px, hi in default color, lo in muted).

**Height:** Medium — ~180px. All content visible without scrolling.

---

### 3. World Clock (`world-clock`)

**What it is:** A quick scan of which markets are open/closed right now.

**Layout:** Vertical list of cities, one row per market.

```
┌──────────────────────────────────────────────────┐
│  🟢  NYSE       US     14:32   OPEN              │
│  🟢  LSE        UK     19:32   OPEN              │
│  🟡  SSE        China  02:32   CLOSED            │
│  🟢  HKEX       HK     02:32   OPEN              │
│  ⚪  TSE        Japan  03:32   CLOSED            │
│  🟢  SGX        SG     02:32   OPEN              │
│  🟡  XETRA      EU     20:32   CLOSED            │
│  🟢  ASX        AU     04:32   OPEN              │
│  ⚪  NSE        India  00:02   CLOSED            │
│  ⚪  DFM        UAE    22:32   CLOSED            │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Dot indicator:** 8px circle. Green = market open. Yellow = daytime but market closed. Gray/ghost = nighttime.
- **City name:** 12px, medium weight. Left-aligned.
- **Market label:** 10px muted, right of city name (e.g., "US", "UK", "China").
- **Live time:** 12px monospace, right-aligned. Updates every 10 seconds.
- **Status:** "OPEN" in green 10px uppercase, or "CLOSED" in muted 10px.
- **Today's row:** Subtle left border accent (2px green) on the current day's primary market.

**Height:** Medium-tall — ~250px for 10 cities. Scrollable if more.

---

### 4. Quick Links (`quick-links`)

**What it is:** A launcher grid — one click to any tool.

**Layout:** 2×4 grid of icon buttons (or responsive wrapping grid).

```
┌──────────────────────────────────────────────────┐
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                │
│  │  🐦 │ │  📝 │ │  💻 │ │  📧 │                │
│  │  X   │ │XHS  │ │Git  │ │Gmail│                │
│  └─────┘ └─────┘ └─────┘ └─────┘                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                │
│  │  📅 │ │  💬 │ │  📓 │ │  🤖 │                │
│  │Cal   │ │Feish│ │Notion│ │GPT  │                │
│  └─────┘ └─────┘ └─────┘ └─────┘                │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Icon button:** 48px square with rounded corners (8px). Background is the link's color at 10% opacity. Icon emoji centered at 20px.
- **Label:** 10px centered text below the icon. Truncated if too long.
- **Hover:** Background brightens to 20% opacity, subtle scale transform (1.05).
- **Click:** Opens link in new tab.
- **Add button:** Dashed border square with "+" in the bottom-right corner (visible on hover).

**Height:** Compact — ~100px for 8 links.

---

### 5. Global Map (`map`)

**What it is:** Ambient world view — news events, flights, and alerts as geographic context.

**Layout:** Full-bleed map filling the panel. Legend overlay bottom-left. Flight toggle bottom-right.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│            [MapLibre GL JS map tiles]             │
│                                                  │
│    ┌─────────┐                          ┌───┐    │
│    │ ✈ Flights│                          │ ✈ │    │
│    │ 🟢 News  │                          └───┘    │
│    │ 🔴 Alert │                                  │
│    │ 🟢 Server│                                  │
│    └─────────┘                                   │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Map:** CARTO dark raster tiles (or light based on theme). Full panel coverage, no padding.
- **Markers:** Pulsing dots (CSS animation). Blue = news. Red = alert. Green = location/server. Airplane emoji with rotation = flight.
- **Popups:** Dark-themed tooltips on marker hover showing type label, title, description, URL link.
- **Legend:** Semi-transparent dark overlay (bottom-left) with dot + label per marker type.
- **Flight toggle:** Airplane icon button (bottom-right). Toggles flight overlay panel.
- **Flight overlay:** Slides in from right. Search input, scrollable flight list with callsign, country, altitude, speed, locate button.

**Height:** Tall — fills available space (min 200px). Panel-wide (2 columns).

---

### 6. AI Summary (`insights`)

**What it is:** Your AI analyst — ask anything, get synthesized answers with data.

**Layout:** Chat interface. Welcome screen → messages → input bar.

```
┌──────────────────────────────────────────────────┐
│  📊 AI Summary                    [Pre-Market]    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  Quick Actions:                           │    │
│  │  [📊 Daily Briefing] [🌤 Weather]         │    │
│  │  [📈 Stock Analysis] [📰 News Summary]    │    │
│  │  [🔧 System Check] [📋 Options Flow]      │    │
│  │  [🌍 Macro Regime] [✅ Habit Check]        │    │
│  │  [📝 View Tasks]                          │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────┐  14:32         │
│  │  What's the overnight summary│  You           │
│  └──────────────────────────────┘                │
│                                                  │
│  📊 ┌──────────────────────────────┐             │
│     │  Overnight, S&P 500 futures  │  Agent      │
│  │  │  +0.3%...                    │             │
│  └──────────────────────────────┘                │
│                                                  │
│  Model: [Claude Opus 4.6 ▾]  🔑                  │
│  ┌──────────────────────────────┐ ──┐            │
│  │  Ask anything...              │ → │            │
│  └──────────────────────────────┘ ──┘            │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Welcome screen:** Title with chart emoji (16px bold), description text (12px muted), 9 quick-action buttons in a flex-wrap grid.
- **Chat bubbles:** User messages right-aligned with subtle background. Agent messages left-aligned with 📊 avatar. Tool messages collapsed with 🔧 icon.
- **Phase badge:** Small pill in header showing current market phase (Pre-Market / Market Hours / Post-Market / After Hours).
- **Model bar:** Dropdown selector + API key status indicator (green key = configured, yellow warning = missing).
- **Input bar:** Text input with send button (→). Input has placeholder "Ask anything...".
- **Auto-scroll:** Chat auto-scrolls to bottom on new messages.

**Height:** Tall — fills available space. Panel-wide (2 columns).

---

### 7. Schedule (`schedule`)

**What it is:** Your day at a glance — meetings and appointments.

**Layout:** Vertical list of events, one row per event.

```
┌──────────────────────────────────────────────────┐
│  09:00   Team Standup                            │
│          Zoom                                    │
│          Join meeting →                          │
│  ─────────────────────────────────────────────── │
│  ▶ 14:00  Portfolio Review  ← currently active   │
│          Conference Room B                        │
│  ─────────────────────────────────────────────── │
│  16:30   Market Close Review                      │
│          Zoom                                    │
│          Join meeting →                          │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Time column:** 12px monospace, left-aligned. "All day" events show at top without time.
- **Title:** 13px medium weight.
- **Location:** 11px muted, below title.
- **Meeting link:** 11px blue underline "Join meeting →" if URL present.
- **Active event:** Left border accent (2px green), subtle background highlight.
- **Empty state:** "No events today" in 12px muted, centered.
- **Divider:** 1px subtle line between events.

**Height:** Medium — ~200px for 3-5 events. Scrollable if more.

---

### 8. Email (`email`)

**What it is:** Inbox pulse — unread count and recent messages.

**Layout:** Vertical list of email rows.

```
┌──────────────────────────────────────────────────┐
│  ●  Q3 Earnings Report Preview                   │
│     Bloomberg · 2h ago                           │
│  ─────────────────────────────────────────────── │
│  ●  Trade Confirmation: AAPL sold 100 @ $195.20  │
│     Schwab · 3h ago                              │
│  ─────────────────────────────────────────────── │
│     Weekly Market Recap                           │
│     Goldman Sachs · 1d ago                       │
│  ─────────────────────────────────────────────── │
│     Fed Minutes Released                          │
│     Reuters · 2d ago                             │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Unread indicator:** Bold dot (●) left of subject for unread emails.
- **Subject:** 12px medium weight. Truncated with ellipsis if too long.
- **Meta:** 10px muted — sender name + relative time.
- **Unread styling:** Subject in brighter text, sender/time in default muted.
- **Read styling:** Subject in slightly muted text.
- **Empty state:** "Inbox zero! 🎉" centered.
- **Count badge:** Header shows unread count (e.g., "Email (3)").

**Height:** Medium — ~200px for 5-8 emails.

---

## MACRO TAB

### 9. Macro Calendar (`macro-calendar`)

**What it is:** Upcoming economic releases — what's moving the market today.

**Layout:** Vertical list of indicator rows, sorted by date.

```
┌──────────────────────────────────────────────────┐
│  HIGH    GDP (Q1 Final)        Jun 27   2.3%     │
│  MEDIUM  Unemployment Rate     Jun 27   4.1%     │
│  HIGH    CPI (YoY)             Jun 28   3.3%     │
│  LOW     PCE Price Index       Jun 30   2.7%     │
│  MEDIUM  Nonfarm Payrolls      Jul 03   +180K    │
│  HIGH    Fed Funds Rate        Jul 31   5.25%    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Impact badge:** 9px uppercase, bold. HIGH = red background. MEDIUM = amber. LOW = green. Consistent width (40px).
- **Indicator name:** 12px medium weight. Left-aligned after badge.
- **Date:** 11px muted, right-aligned.
- **Value:** 12px monospace, rightmost column. Color-coded: green if better than expected, red if worse, default if neutral.
- **Row hover:** Subtle background highlight.

**Height:** Medium — ~200px for 6 indicators.

---

### 10. Economic Indicators (`economic-indicators`)

**What it is:** Key macro data with trend visualization — is the economy accelerating or decelerating?

**Layout:** Vertical list, each indicator has header + sparkline.

```
┌──────────────────────────────────────────────────┐
│  GDP (Q1 Final)                    2.3%          │
│  Jun 2025  ·  YoY: +0.4%  ▲                     │
│  ──────────────────────────────────────────      │
│                                            ▄▄█   │
│  ──────────────────────────────────────────      │
├──────────────────────────────────────────────────┤
│  CPI (YoY)                        3.3%          │
│  Jun 2025  ·  YoY: -0.2%  ▼                     │
│  ──────────────────────────────────────────      │
│  █▄▄▂▂▁▁▁▁▁▁▁▁▁                                 │
│  ──────────────────────────────────────────      │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Indicator name:** 12px medium weight, left-aligned.
- **Current value:** 14px bold, right-aligned. Color-coded by direction.
- **Meta row:** 10px muted — date + YoY change (green ▲ if positive, red ▼ if negative).
- **Sparkline:** SVG mini-chart (full width, 24px height). Last 20 data points. Line color matches direction (green for rising positive indicators like GDP, red for rising negative indicators like CPI).
- **Separator:** 1px line between indicators.

**Height:** Medium-tall — ~250px for 5 indicators (each ~50px with sparkline).

---

### 11. Central Bank Tracker (`central-bank-tracker`)

**What it is:** Policy rate at a glance — are we hiking, cutting, or holding?

**Layout:** Two sections: current rate hero block + rate history table.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│              5.25%                               │
│     Fed Funds Rate  ◆  Hold                      │
│     Dec 18, 2024                                 │
│                                                  │
├──────────────────────────────────────────────────┤
│  Rate Decisions (monthly)                        │
│  ─────────────────────────────────────────────── │
│  2024-12   5.25%   ◆ hold                       │
│  2024-11   5.25%   ◆ hold                       │
│  2024-09   5.00%   ▼ cut                        │
│  2024-07   5.25%   ◆ hold                       │
│  2024-06   5.25%   ◆ hold                       │
│  2024-05   5.25%   ◆ hold                       │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Current rate block:** Centered. Rate in 32px bold. "Fed Funds Rate" label in 12px muted. Direction arrow (▲ hike = red, ▼ cut = green, ◆ hold = amber) + label in 12px. Date in 10px muted.
- **Background tint:** Subtle color wash based on direction (red-ish for hike, green-ish for cut, neutral for hold).
- **History table:** Left-aligned. Date (11px monospace), rate (12px bold), change arrow + label.
- **Section title:** 11px uppercase letter-spaced muted.

**Height:** Medium — ~200px.

---

### 12. Yield Curve (`yield-curve`)

**What it is:** Recession signal — is the curve inverted?

**Layout:** Three sections: regime indicator, bar chart, spread display.

```
┌──────────────────────────────────────────────────┐
│  Curve: ⚠ Inverted                               │
├──────────────────────────────────────────────────┤
│                                                  │
│  3M    2Y    5Y    10Y   30Y                     │
│  ███   ████  █████ █████████ ████████████        │
│  5.3%  4.7%  4.4%  4.2%   4.4%                  │
│                                                  │
├──────────────────────────────────────────────────┤
│  2s10s: -52bp  ▼    3m10s: -110bp  ▼             │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Regime indicator:** 12px text. "⚠ Inverted" in red, "✅ Normal" in green.
- **Bar chart:** 5 vertical bars with dynamic heights (proportional to yield). Each bar has term label below (10px) and value (11px monospace). Bar color: gradient from green (normal) to red (inverted).
- **Spread display:** Two spread values in 12px. Negative (inverted) = red with ▼. Positive (normal) = green with ▲. Basis points unit shown.

**Height:** Medium — ~180px.

---

## NEWS TAB

### 13. Financial News (`financial-news`)

**What it is:** Multi-source RSS aggregation — what's happening in the world right now.

**Layout:** Category tabs + scrollable article card list.

```
┌──────────────────────────────────────────────────┐
│  [Tech] [Finance] [World] [AI] [China] [Sources] │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │ ███ │ 🖼️ │ Fed Signals Rate Cut Delay    │    │
│  │     │    │ Minutes reveal deeper divide   │    │
│  │     │    │ among policymakers...           │    │
│  │     │    │ 🟦 Reuters  · 2h  ·  HIGH      │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │ ███ │ 🖼️ │ China GDP Beats Expectations   │    │
│  │     │    │ Q2 growth at 5.3% vs 5.0% est  │    │
│  │     │    │ 🟪 Al Jazeera · 3h · MEDIUM    │    │
│  └──────────────────────────────────────────┘    │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Category tabs:** Multi-select filter buttons (10px). Active tab has accent background. "Sources" button opens source manager panel.
- **Article cards:** Left threat-level color bar (3px, color = severity). Thumbnail image (48px square, rounded). Title (13px bold, clickable). Description (11px muted, 2-line clamp). Source badge (colored pill) + time + threat level label + keyword badges.
- **Threat colors:** CRITICAL = red, HIGH = orange, MEDIUM = amber, LOW = green, INFO = blue.
- **Source manager:** Collapsible panel with toggle switches per RSS source, add new source form.

**Height:** Tall — panel-wide. Scrollable. ~800px visible.

---

### 14. Social Sentiment (`social-sentiment`)

**What it is:** Aggregate social buzz — which stocks are trending and what's the sentiment.

**Layout:** Tabs + summary bars + expandable mention list.

```
┌──────────────────────────────────────────────────┐
│  [Trending] [Reddit] [Twitter]    [📋 Watchlist]  │
├──────────────────────────────────────────────────┤
│  NVDA  ████████████████████░░░░  +0.82  234 mentions │
│  AAPL  ██████████████░░░░░░░░░░  +0.45  189 mentions │
│  TSLA  ████████░░░░░░░░░░░░░░░░  -0.23  156 mentions │
│  MSFT  ██████████████████████░░  +0.91  134 mentions │
│  AMZN  █████████████░░░░░░░░░░░  +0.34  121 mentions │
├──────────────────────────────────────────────────┤
│  NVDA (234)                          ▼ expand     │
│  ████████████████████████  +0.82                  │
│    • NVIDIA earnings beat estimates (45 pts)       │
│    • AI demand surge continues (32 pts)            │
│  ─────────────────────────────────────────────── │
│  TSLA (156)                          ▼ expand     │
│  ████████████  -0.23                              │
│    • Cybertruck recall news (28 pts)              │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Summary section:** Top 8 symbols with horizontal sentiment bars. Bar fill color: green (>0.1), red (<-0.1), gray (neutral). Score in 11px, mention count in 10px muted.
- **Mention list:** Expandable rows per symbol. Click to reveal individual posts with title link, score, platform badge.
- **Sentiment bar:** 6px height, full width, animated width transition.

**Height:** Tall — panel-wide. Summary (~150px) + list (~40px per item).

---

### 15. Social Monitor (`social-monitor`)

**What it is:** Unified social feed — Reddit, Truth Social, and X in one view.

**Layout:** Platform tabs + scrollable post list.

```
┌──────────────────────────────────────────────────┐
│  [All] [Reddit] [Truth] [X]     [Watchlist]      │
├──────────────────────────────────────────────────┤
│  🟠 Reddit  NVDA earnings thread      1.2k  │
│     u/trader_bot · NVDA · AAPL · 2h ago          │
│  ─────────────────────────────────────────────── │
│  🔵 X       Market feels toppy here     856  │
│     @macro_hawk · SPY · QQQ · 3h ago             │
│  ─────────────────────────────────────────────── │
│  ⬛ Truth   Tariffs coming back strong   432  │
│     @potus_official · general · 4h ago            │
│  ─────────────────────────────────────────────── │
│  🟠 Reddit  Rate cut probability now 72%  389   │
│     u/econ_watcher · DIA · 5h ago                │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Platform badges:** 9px colored pills. Reddit = #ff4500, Truth Social = #1a1a2e, X = #1d9bf0.
- **Post title:** 12px medium weight, truncated at ~100 chars. Clickable (opens in new tab).
- **Score:** 11px bold, right-aligned. Thumbs-up color matching platform.
- **Meta:** 10px muted — author, ticker tags, time.
- **Ticker tags:** Small colored pills (same style as sentiment-symbol class).
- **Sorted by:** Score descending.

**Height:** Tall — panel-wide. Scrollable. Each row ~50px.

---

## TRADING TAB

### 16. Trading Terminal (`trading`)

**What it is:** Gateway to the full terminal — one click to deep analysis.

**Layout:** Brand block + view options + launch button.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ▮ BLMTRM                                        │
│  Bloomberg-style terminal · charts · screener     │
│                                                  │
│  MRKT  Market Overview    Real-time quotes        │
│  CHRT  Chart Analysis     Interactive charts      │
│  SCRN  Stock Screener     Filter & discover       │
│  ECON  Economic Data      Macro indicators        │
│  AI    AI Assistant       Natural language         │
│  PORT  Portfolio          Holdings & P&L           │
│                                                  │
│  OPEN WITH: [AAPL] [MSFT] [NVDA] [TSLA]          │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │        LAUNCH TERMINAL ↗                  │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Brand:** Logo icon + "BLMTRM" in 16px bold monospace. Tagline in 11px muted.
- **View options:** 6 rows with code badge (9px monospace, colored), label (12px bold), description (11px muted).
- **Symbol pills:** Watchlist symbols as clickable 10px pills. Click to pre-load symbol in terminal.
- **Launch button:** Full-width accent button with arrow icon. Bold 13px text.

**Height:** Medium — ~220px. Panel-wide.

---

### 17. Markets (`stocks`)

**What it is:** Watchlist with expandable charts — your market radar.

**Layout:** Tabs + symbol rows (collapsed/expanded) + add bar.

```
┌──────────────────────────────────────────────────┐
│  [Stocks] [ETFs] [Crypto] [Cmdty]          [+ ]  │
├──────────────────────────────────────────────────┤
│  NVDA   NVIDIA Corp      $195.20  +2.34  ▃▅▇█  ▸│
│  AAPL   Apple Inc        $195.20  -0.45  ▅▄▃▂  ▸│
│  ▶ MSFT  Microsoft Corp  $420.15  +1.12  ▃▅▇█    │
│    ┌──────────────────────────────────────────┐  │
│    │ [5m] [15m] [1H] [1D] [1W] [1M]          │  │
│    │                                          │  │
│    │     📈 Candlestick chart (240px)         │  │
│    │                                          │  │
│    │  ──────────────────────────────────────  │  │
│    │  RSI: 62.3  PE: 45.2  MCap: $4.8T       │  │
│    └──────────────────────────────────────────┘  │
│  TSLA   Tesla Inc        $195.20  -1.23  ▇█▅▃  ▸│
│  AMZN   Amazon.com       $195.20  +0.89  ▃▅▇█  ▸│
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Collapsed row:** Symbol (12px bold), name (11px muted), price (12px monospace), change% (11px color-coded), sparkline (SVG, 60px wide), expand arrow.
- **Expanded row:** Timeframe selector (10px pills), full candlestick/line/area chart (240px, Lightweight Charts v5), optional RSI sub-chart (60px), fundamentals bar (PE, MCap, etc.), sentiment badge, portfolio badge.
- **Add bar:** Search input with autocomplete dropdown. Results show symbol, name, exchange.
- **Row hover:** Subtle background highlight.

**Height:** Tall — variable. Collapsed rows ~40px each. Expanded row ~380px.

---

### 18. Portfolio (`finance`)

**What it is:** Your P&L at a glance — positions, allocation, day change.

**Layout:** Summary block + allocation bar + holdings list.

```
┌──────────────────────────────────────────────────┐
│  Portfolio Value        $124,532.18              │
│  Cash: $12,450  ·  Buying Power: $24,900         │
│  Day P&L: +$1,234.56 (+1.02%)  ▲                │
├──────────────────────────────────────────────────┤
│  ████████████████████████████████████████████     │
│  NVDA 32% · AAPL 24% · MSFT 18% · Cash 14%      │
├──────────────────────────────────────────────────┤
│  NVDA    50 shares   $195.20   +2.3%   $9,760    │
│  AAPL   100 shares   $195.20   -0.4%  $19,520    │
│  MSFT    30 shares   $420.15   +1.1%  $12,605    │
│  GOOGL   20 shares   $175.80   +0.9%   $3,516    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Summary:** Total value in 20px bold. Cash/buying power in 11px muted. Day P&L in 13px, color-coded.
- **Allocation bar:** Horizontal stacked bar (8px height). Each segment colored by holding. Tooltip on hover shows symbol + percentage.
- **Holdings list:** Columns: symbol (bold), shares, current price, day change%, market value, total return. All numeric values right-aligned. Color-coded by direction.
- **Remove button:** × icon on hover for manual positions.

**Height:** Medium-tall — ~300px.

---

### 19. Options Flow (`options-flow`)

**What it is:** Smart money signals — unusual activity and block trades.

**Layout:** Tabs + summary cards or data grid.

```
┌──────────────────────────────────────────────────┐
│  [Summary] [Unusual] [Flow]                      │
├──────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐                       │
│  │ P/C Ratio│ │  Total   │                       │
│  │   0.82   │ │  12.4M   │                       │
│  │  ▼ bearish│ │  contracts│                      │
│  └──────────┘ └──────────┘                       │
│  ┌──────────┐ ┌──────────┐                       │
│  │  Calls   │ │   Puts   │                       │
│  │  6.8M    │ │  5.6M    │                       │
│  │  (55%)   │ │  (45%)   │                       │
│  └──────────┘ └──────────┘                       │
│                                                  │
│  Symbol C/P  Strike  Expiry   Vol    OI   V/OI   │
│  NVDA   C   $200   Jul 18   12.4K  8.2K  1.5   │
│  AAPL   P   $190   Jul 18    8.1K  5.4K  1.5   │
│  TSLA   C   $210   Jul 18    6.7K  3.1K  2.2   │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Summary tab:** 2×2 grid of stat cards. P/C Ratio (color: <0.8 green/bearish, >1.2 red/bullish), Total Volume, Call Volume (green), Put Volume (red).
- **Unusual tab:** Data grid with columns: Symbol, C/P badge (green C, red P), Strike, Expiry, Volume, Open Interest, V/OI ratio (highlight if >1.5), Sentiment arrow.
- **Flow tab:** Block trades sorted by premium. Each row: symbol, type, strike, expiry, sentiment icon, premium value (bold), contract count.

**Height:** Medium-tall — ~280px. Panel-wide.

---

### 20. Whale Transactions (`onchain`)

**What it is:** Crypto whale movements — large transfers that move markets.

**Layout:** Vertical list of transaction rows.

```
┌──────────────────────────────────────────────────┐
│  🟠 ● BTC   500 BTC    $21.5M                   │
│     0x1a2b…3c4d  Exchange  →  0x5e6f…7g8h  Wallet│
│     12 min ago                                   │
│  ─────────────────────────────────────────────── │
│  🔵 ● ETH  10,000 ETH  $34.2M                   │
│     0x9i0j…1k2l  Whale     →  0x3m4n…5o6p  Binance│
│     28 min ago                                   │
│  ─────────────────────────────────────────────── │
│  🟠 ● BTC   200 BTC    $8.6M                    │
│     0x7q8r…9s0t  Unknown   →  0x1u2v…3w4x  Coinbase│
│     1 hr ago                                     │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Left border:** 3px colored by type — orange = exchange outflow, green = exchange inflow, blue = transfer, gray = unknown.
- **Blockchain dot:** 8px colored circle. Bitcoin = #f7931a, Ethereum = #627eea.
- **Symbol pill:** Small badge with BTC/ETH.
- **Amount + USD:** Amount in 12px bold, USD in 11px muted.
- **From → To:** Truncated addresses (first 6 + last 4 chars) with exchange labels (Exchange, Whale, Binance, Coinbase, etc.).
- **Time:** 10px muted, relative.

**Height:** Medium-tall — ~300px. Panel-wide.

---

### 21. Volatility Index (`volatility-index`)

**What it is:** VIX deep dive — term structure, percentile, and context.

**Layout:** Header + percentile bar + details grid.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  28.47                    ▲ 2.34 (+8.2%)         │
│  Elevated                  1 Day Change           │
│                                                  │
│  52w Low: 12.4    ████████████████░░░░    52w High: 45.7 │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Previous Close│  │  52w Range   │              │
│  │    26.13      │  │  12.4 — 45.7 │              │
│  └──────────────┘  └──────────────┘              │
│  ┌──────────────────────────────────────┐        │
│  │  Term Structure: Contango (normal)   │        │
│  └──────────────────────────────────────┘        │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Header:** Price in 32px bold, color-coded. Label below in 13px. Change + percent right-aligned with "1 Day Change" sublabel.
- **Percentile bar:** Horizontal bar (6px height) showing position within 52-week range. Fill color matches fear state. Low/high labels at ends.
- **Details grid:** 2-column grid of key-value pairs on subtle background cards.
- **Term structure:** "Contango (normal)" in green or "Backwardation (signal)" in red.

**Height:** Medium — ~180px. Panel-wide.

---

## STRATEGY TAB

### 22. Strategy Journal (`strategy-journal`)

**What it is:** Your trading playbook — capture and refine your edge.

**Layout:** Stats bar + entry cards.

```
┌──────────────────────────────────────────────────┐
│  [+ New Entry]                                   │
│  12 total entries                                │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  Momentum Breakout Strategy              │    │
│  │  Jun 22, 2025                            │    │
│  │  Buy when 20EMA crosses above 50EMA on   │    │
│  │  high volume. Set stop at 2% below...    │    │
│  │  [momentum] [breakout] [2 trades]        │    │
│  │  Edit · Delete                           │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  Mean Reversion on Oversold RSI          │    │
│  │  Jun 18, 2025                            │    │
│  │  Enter when RSI < 30 on 4H chart. Take   │    │
│  │  profit at 50% Fibonacci retracement...  │    │
│  │  [mean-reversion] [RSI] [5 trades]       │    │
│  │  Edit · Delete                           │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **"+ New Entry" button:** Top of panel, accent color.
- **Stats bar:** "12 total entries" in 11px muted.
- **Entry cards:** Title (13px bold), date (10px muted), content preview (11px, 120 char clamp), tags (colored pills), linked trade count, Edit/Delete action links.
- **Empty state:** "No strategies yet. Create one to start tracking your edge."

**Height:** Medium-tall — ~300px. Scrollable.

---

### 23. Trade Review (`trade-review`)

**What it is:** Post-trade analysis — learn from wins and losses.

**Layout:** Filter tabs + pattern analysis + trade cards.

```
┌──────────────────────────────────────────────────┐
│  [All] [Win] [Loss]    [+ Add Trade] [📥 Snap]   │
├──────────────────────────────────────────────────┤
│  📊 Pattern Analysis (12 trades)                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │Win Rate│ │Total   │ │Avg Win │ │Avg Loss│    │
│  │  67%   │ │+$4,230 │ │ +$890  │ │ -$340  │    │
│  └────────┘ └────────┘ └────────┘ └────────┘    │
│  Long: 72% (8)  Short: 50% (4)                   │
│  Best: NVDA +$1,200 · AAPL +$890                 │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  NVDA  ▲ LONG         +$1,200 (+6.2%)   │    │
│  │  Entry: $185.20  Exit: $196.80  Qty: 100 │    │
│  │  Jun 15 → Jun 22                         │    │
│  │  "Broke out on earnings beat"            │    │
│  │  [earnings] [momentum]     Delete         │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Pattern analysis:** 4-column stat grid (Win Rate, Total P&L, Avg Win, Avg Loss). Long/Short breakdown. Top 3 symbols.
- **Trade cards:** Symbol (bold), direction badge (LONG green, SHORT red), P&L (color-coded), entry/exit prices, quantity, percent, date range, notes, tags, Delete button.
- **Win/loss styling:** Win cards have green left border. Loss cards have red left border.

**Height:** Tall — ~400px. Scrollable.

---

### 24. Playbook Manager (`playbook-manager`)

**What it is:** Codified trading rules — what works, ranked by effectiveness.

**Layout:** Playbook cards with effectiveness scores.

```
┌──────────────────────────────────────────────────┐
│  [+ New Playbook]                                │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  Momentum Breakout           78%         │    │
│  │  12 trades  ████████████████░░░░         │    │
│  │  Buy when 20EMA crosses 50EMA on high    │    │
│  │  volume with RSI > 50 confirmation...    │    │
│  │  [momentum] [breakout]                    │    │
│  │  Edit · Delete                           │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  Mean Reversion              65%         │    │
│  │  8 trades   █████████████░░░░░░░░        │    │
│  │  Enter when RSI < 30 on 4H chart...      │    │
│  │  [mean-reversion] [RSI]                   │    │
│  │  Edit · Delete                           │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Playbook cards:** Name (13px bold), effectiveness score (16px bold, color-coded: green >70%, amber 40-70%, red <40%), trade count, horizontal progress bar (filled to score%), description (11px, 2-line clamp), tags, Edit/Delete.
- **Progress bar:** 6px height. Fill color matches score color.

**Height:** Medium-tall — ~300px. Scrollable.

---

### 25. Backtest Log (`backtest-log`)

**What it is:** Strategy validation — did it work in history?

**Layout:** Backtest cards with metrics + equity curves.

```
┌──────────────────────────────────────────────────┐
│  [+ New Backtest]                                │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  Momentum Breakout v2        +45.2%      │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────┐│    │
│  │  │Win Rate│ │Sharpe  │ │Max DD  │ │Trds││    │
│  │  │  62%   │ │  1.8   │ │ -12%   │ │ 48 ││    │
│  │  └────────┘ └────────┘ └────────┘ └────┘│    │
│  │  ▁▂▃▄▅▆▇████▇▆▅▄▃▂▁▂▃▄▅▆▇████▇▆▅       │    │
│  │  Jan 2024 → Jun 2025                     │    │
│  │  Delete                                  │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Backtest cards:** Strategy name (13px bold), total return (16px bold, color-coded), 4-metric grid (Win Rate, Sharpe, Max Drawdown, Trades), SVG equity curve sparkline (full width, 32px height), date range, Delete button.
- **Equity curve:** Line chart showing portfolio value over time. Green if positive return, red if negative.

**Height:** Medium-tall — ~280px. Scrollable.

---

## PERSONAL TAB

### 26. Habit Tracker (`habit-tracker`)

**What it is:** Daily consistency — track the habits that compound.

**Layout:** Habit cards with log/done status.

```
┌──────────────────────────────────────────────────┐
│  [+ New Habit]                                   │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  📖 Read 30 min          Health · 🔥 12  │    │
│  │  Target: 30 min                           │    │
│  │  [Log Today]                              │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  🧘 Meditate 10 min      Mind · 🔥 5    │    │
│  │  Target: 10 min                           │    │
│  │  ✅ Done today              Delete        │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  💪 Exercise 45 min      Fitness · 🔥 8  │    │
│  │  Target: 45 min                           │    │
│  │  [Log Today]                              │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Habit cards:** Emoji + name (13px bold), category badge (colored pill), streak count (🔥 N days), target duration, "Log Today" button or "✅ Done today" indicator.
- **Done styling:** Green left border, slightly dimmed (completed tasks recede).
- **Streak fire:** 🔥 emoji in orange for streaks > 0.

**Height:** Medium — ~250px. Scrollable.

---

### 27. Health Metrics (`health-metrics`)

**What it is:** Wellness data — sleep, exercise, vitals at a glance.

**Layout:** Metric cards with values.

```
┌──────────────────────────────────────────────────┐
│  [+ Add Metric]                                  │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  💤 Sleep            7.5 hrs   Jun 23    │    │
│  │  "Good quality, fell asleep quickly"      │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  🏃 Exercise         45 min    Jun 23    │    │
│  │  "Morning run, 5K"                       │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  💧 Water            8 cups    Jun 23    │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  ⚖️  Weight           175 lbs   Jun 22    │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Metric cards:** Emoji + type (13px bold), value + unit (14px, right-aligned), date (10px muted), notes (11px muted, if present).
- **Type icons:** 💤 Sleep, 🏃 Exercise, 💧 Water, 📏 Steps, ⚖️ Weight, ❤️ Heart Rate, 🩸 Blood Pressure, 📱 Screen Time.

**Height:** Medium — ~200px. Scrollable.

---

### 28. Routine Scheduler (`routine-scheduler`)

**What it is:** Your daily structure — morning routine, work blocks, evening wind-down.

**Layout:** Routine cards with day-of-week indicators.

```
┌──────────────────────────────────────────────────┐
│  [+ New Routine]                                 │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  🌅 Morning Routine      Morning         │    │
│  │  Meditation, reading, exercise            │    │
│  │  ● ● ● ● ● ○ ○                            │    │
│  │  Mon Tue Wed Thu Fri Sat Sun              │    │
│  │  Delete                                   │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  📊 Market Review         Pre-Market      │    │
│  │  Check VIX, scan news, review positions   │    │
│  │  ● ● ● ● ● ○ ○                            │    │
│  │  Mon Tue Wed Thu Fri Sat Sun              │    │
│  │  Delete                                   │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  🌙 Evening Wind-Down    Evening          │    │
│  │  Review trades, journal, plan tomorrow    │    │
│  │  ● ● ● ● ● ○ ○                            │    │
│  │  Mon Tue Wed Thu Fri Sat Sun              │    │
│  │  Delete                                   │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Routine cards:** Emoji + name (13px bold), time of day badge (Morning/Afternoon/Evening), description (11px muted), day-of-week dots (● filled = active, ○ outline = inactive, today highlighted), Delete button.
- **Today's dot:** Slightly larger or accented.

**Height:** Medium — ~250px. Scrollable.

---

### 29. Mental Check-In (`mental-checkin`)

**What it is:** Emotional awareness — how are you really doing?

**Layout:** Today's check-in + recent history.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│       How are you feeling today?                 │
│       [Start Check-In]                           │
│                                                  │
├──────────────────────────────────────────────────┤
│  Today's Check-In                                │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │  😊    │ │  ⚡    │ │  😌    │               │
│  │ Mood   │ │ Energy │ │ Stress │               │
│  │  8/10  │ │  7/10  │ │  3/10  │               │
│  └────────┘ └────────┘ └────────┘               │
│  "Feeling good after morning workout"            │
│  [Update]                                        │
├──────────────────────────────────────────────────┤
│  Recent                                         │
│  Jun 23  😀 8   ⚡ 7   💥 3                     │
│  Jun 22  😐 5   ⚡ 6   💥 5                     │
│  Jun 21  😀 9   ⚡ 8   💥 2                     │
│  Jun 20  😔 4   ⚡ 4   💥 7                     │
│  Jun 19  😊 7   ⚡ 6   💥 4                     │
└──────────────────────────────────────────────────┘
```

**Visual details:**
- **Prompt state:** Centered question text (16px), "Start Check-In" button.
- **Today's check-in:** 3 score cards in a row. Each: emoji (24px), label (10px muted), value/10 (16px bold, color-coded: green ≥8, amber 5-7, red <5). Notes text (11px muted). "Update" button.
- **History section:** Recent 7 days as rows. Date, mood emoji + score, energy emoji + score, stress emoji + score. All color-coded.

**Height:** Medium — ~200px.

---

## Color System

| Token | Usage | Hex |
|-------|-------|-----|
| `--positive` | Up, profit, bullish, normal | `#22c55e` |
| `--negative` | Down, loss, bearish, inverted | `#ef4444` |
| `--warning` | Elevated, caution, hold | `#f59e0b` |
| `--accent` | Active tabs, buttons, highlights | `#3b82f6` |
| `--bg` | Panel background | `#0f1117` |
| `--surface` | Card background | `#1a1d27` |
| `--border` | Dividers, borders | `#2a2d3a` |
| `--text-primary` | Primary text | `#e4e4e7` |
| `--text-muted` | Secondary text | `#71717a` |

## Typography

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Panel title | 12px | 600 | System |
| Section title | 11px | 600 | System |
| Body text | 12px | 400 | System |
| Data values | 12px | 600 | Monospace |
| Large numbers | 20-32px | 700 | System |
| Labels | 10px | 400 | System |
| Badges | 9-10px | 600 | System |

## Spacing

| Element | Padding/Gap |
|---------|-------------|
| Panel content | 8-12px |
| Card padding | 8-12px |
| List row padding | 6-8px |
| Gap between cards | 6px |
| Section separator | 1px line, 8px margin |
