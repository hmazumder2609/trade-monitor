# Phase 1: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Add real-time WebSocket streaming, price alerts, skeleton loading, unsaved-changes protection, and keyboard shortcuts to elevate the dashboard from mockup to professional tool.

**Architecture:** Finnhub WebSocket is proxied through the Express server (which already handles HTTP Finnhub calls). A new client-side `RealtimeQuotes` module connects to the server WS, receives trade updates, and pushes them through the existing DataLayer pub/sub. Skeleton loading replaces the radar animation with content-shaped placeholders. Settings modal gains dirty-state tracking. Global keyboard shortcuts are added via a single `keydown` listener in `main.ts`.

**Tech Stack:** `ws` (server WebSocket), native `WebSocket` (client), existing DataLayer pub/sub, existing Panel base class, existing SettingsModal.

---

## Task 1: Server-Side Finnhub WebSocket Proxy

**Files:**
- Modify: `server/index.ts` — add WS upgrade handler
- Create: `server/routes/finnhub-ws.ts` — WebSocket proxy logic

**Step 1: Install `ws` package**

```bash
npm install ws
npm install -D @types/ws
```

**Step 2: Create `server/routes/finnhub-ws.ts`**

```ts
import WebSocket from 'ws';

const FINNHUB_WS_URL = 'wss://ws.finnhub.io';
const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;

interface ClientSet {
  clients: Set<WebSocket>;
  symbols: Set<string>;
}

export function createFinnhubBridge(apiKey: string) {
  let finnhubWs: WebSocket | null = null;
  let reconnectDelay = RECONNECT_BASE_DELAY;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const clientSets = new Map<string, ClientSet>();

  function connect() {
    if (finnhubWs?.readyState === WebSocket.OPEN) return;

    finnhubWs = new WebSocket(`${FINNHUB_WS_URL}?token=${apiKey}`);

    finnhubWs.on('open', () => {
      reconnectDelay = RECONNECT_BASE_DELAY;
      startHeartbeat();
      // Re-subscribe all tracked symbols
      for (const [, cs] of clientSets) {
        for (const sym of cs.symbols) {
          finnhubWs!.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
        }
      }
    });

    finnhubWs.on('message', (raw: WebSocket.Data) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'trade') {
        // Relay trade data to all connected browser clients
        for (const [, cs] of clientSets) {
          for (const client of cs.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(msg));
            }
          }
        }
      }
    });

    finnhubWs.on('close', () => {
      stopHeartbeat();
      scheduleReconnect();
    });

    finnhubWs.on('error', () => {
      finnhubWs?.close();
    });
  }

  function scheduleReconnect() {
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY);
      connect();
    }, reconnectDelay);
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (finnhubWs?.readyState === WebSocket.OPEN) {
        finnhubWs.ping();
      }
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function subscribe(symbol: string, clientWs: WebSocket) {
    const clientId = (clientWs as any)._id || Math.random().toString(36);
    if (!clientSets.has(clientId)) {
      clientSets.set(clientId, { clients: new Set(), symbols: new Set() });
    }
    const cs = clientSets.get(clientId)!;
    cs.clients.add(clientWs);
    cs.symbols.add(symbol);

    // If this is a new symbol, subscribe on Finnhub
    const allSymbols = new Set<string>();
    for (const [, s] of clientSets) {
      for (const sym of s.symbols) allSymbols.add(sym);
    }
    if (allSymbols.size > /* previous count */ 0) {
      // Only subscribe new symbols
    }
    if (finnhubWs?.readyState === WebSocket.OPEN) {
      finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  function unsubscribe(symbol: string, clientWs: WebSocket) {
    const clientId = (clientWs as any)._id;
    const cs = clientSets.get(clientId);
    if (cs) {
      cs.symbols.delete(symbol);
      cs.clients.delete(clientWs);
      if (cs.clients.size === 0) clientSets.delete(clientId);
    }
  }

  function removeClient(clientWs: WebSocket) {
    const clientId = (clientWs as any)._id;
    const cs = clientSets.get(clientId);
    if (cs) {
      // Unsubscribe all symbols for this client from Finnhub
      for (const sym of cs.symbols) {
        if (finnhubWs?.readyState === WebSocket.OPEN) {
          finnhubWs.send(JSON.stringify({ type: 'unsubscribe', symbol: sym }));
        }
      }
      clientSets.delete(clientId);
    }
  }

  function shutdown() {
    stopHeartbeat();
    finnhubWs?.close();
    clientSets.clear();
  }

  return { connect, subscribe, unsubscribe, removeClient, shutdown };
}
```

**Step 3: Wire into `server/index.ts`**

Add after the existing imports:
```ts
import { createFinnhubBridge } from './routes/finnhub-ws';
import { WebSocketServer } from 'ws';
```

After creating the Express app, before `server.listen()`:
```ts
const finnhubKey = process.env.FINNHUB_API_KEY || '';
let finnhubBridge: ReturnType<typeof createFinnhubBridge> | null = null;

if (finnhubKey) {
  finnhubBridge = createFinnhubBridge(finnhubKey);
  finnhubBridge.connect();
}

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/finnhub') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as any)._id = Math.random().toString(36).slice(2);
      wss.emit('connection', ws, request);

      ws.on('message', (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'subscribe' && msg.symbol && finnhubBridge) {
            finnhubBridge.subscribe(msg.symbol, ws);
          }
          if (msg.type === 'unsubscribe' && msg.symbol && finnhubBridge) {
            finnhubBridge.unsubscribe(msg.symbol, ws);
          }
        } catch { /* ignore malformed */ }
      });

      ws.on('close', () => {
        finnhubBridge?.removeClient(ws);
      });
    });
  } else {
    socket.destroy();
  }
});
```

**Step 4: Verify server starts**

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add server/routes/finnhub-ws.ts server/index.ts package.json package-lock.json
git commit -m "feat(server): add Finnhub WebSocket proxy for real-time price streaming"
```

---

## Task 2: Client-Side RealtimeQuotes DataLayer Source

**Files:**
- Create: `src/services/data-layer/sources/realtime-quotes.ts`
- Modify: `src/services/data-layer/index.ts` — export new source

**Step 1: Create `src/services/data-layer/sources/realtime-quotes.ts`**

```ts
import { dataLayer } from '../DataLayer';
import type { StockQuote } from '@/types';

const REALTIME_SOURCE_ID = 'realtime-quotes';
const WS_PATH = '/ws/finnhub';
const RECONNECT_BASE = 1_000;
const RECONNECT_MAX = 15_000;
const STALE_TIMEOUT = 10_000;

let ws: WebSocket | null = null;
let reconnectDelay = RECONNECT_BASE;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let staleTimer: ReturnType<typeof setInterval> | null = null;
let subscribedSymbols = new Set<string>();
let connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

type ConnectionStateCallback = (state: string) => void;
const connectionListeners = new Set<ConnectionStateCallback>();

function notifyConnection() {
  for (const cb of connectionListeners) cb(connectionState);
}

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${WS_PATH}`;
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
  connectionState = 'connecting';
  notifyConnection();

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    connectionState = 'connected';
    reconnectDelay = RECONNECT_BASE;
    notifyConnection();
    // Re-subscribe
    for (const sym of subscribedSymbols) {
      ws!.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
    }
    startStaleCheck();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'trade' && Array.isArray(msg.data)) {
        for (const trade of msg.data) {
          const quote: StockQuote = {
            symbol: trade.s,
            name: '', // will be enriched by consumer
            price: trade.p,
            change: null,
            changePercent: null,
            high: null,
            low: null,
            previousClose: null,
            sparkline: [],
            _realtime: true,
            _timestamp: trade.t || Date.now(),
          } as StockQuote & { _realtime: boolean; _timestamp: number };

          dataLayer.publish(REALTIME_SOURCE_ID, quote);
        }
      }
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    connectionState = 'disconnected';
    notifyConnection();
    stopStaleCheck();
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
    connect();
  }, reconnectDelay);
}

function startStaleCheck() {
  stopStaleCheck();
  staleTimer = setInterval(() => {
    // If no data received in STALE_TIMEOUT, connection might be dead
    // The server heartbeat handles this, but this is a client-side fallback
  }, STALE_TIMEOUT);
}

function stopStaleCheck() {
  if (staleTimer) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
}

export function subscribeRealtimeSymbol(symbol: string): () => void {
  subscribedSymbols.add(symbol);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', symbol }));
  }
  // Ensure connection is active
  connect();

  return () => {
    subscribedSymbols.delete(symbol);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  };
}

export function onRealtimeConnectionChange(cb: ConnectionStateCallback): () => void {
  connectionListeners.add(cb);
  cb(connectionState);
  return () => connectionListeners.delete(cb);
}

export function initRealtimeQuotes(): void {
  // Register the source so other modules can subscribe
  // Individual quotes are published via dataLayer.publish() from the WS handler
  connect();
}

export function disconnectRealtime(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopStaleCheck();
  ws?.close();
  ws = null;
  connectionState = 'disconnected';
  notifyConnection();
}
```

**Step 2: Add `_realtime` and `_timestamp` to StockQuote type**

Find the `StockQuote` type (likely in `src/types.ts` or `src/services/data-layer/sources/market-quotes.ts`) and add optional fields:

```ts
export interface StockQuote {
  // ... existing fields ...
  _realtime?: boolean;
  _timestamp?: number;
}
```

**Step 3: Export from `src/services/data-layer/index.ts`**

Add:
```ts
export { initRealtimeQuotes, subscribeRealtimeSymbol, onRealtimeConnectionChange, disconnectRealtime } from './sources/realtime-quotes';
```

**Step 4: Initialize in `src/main.ts`**

Add near the top, after DataLayer initialization:
```ts
import { initRealtimeQuotes } from '@/services/data-layer';

// In the init block:
initRealtimeQuotes();
```

**Step 5: Type check**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/services/data-layer/sources/realtime-quotes.ts src/services/data-layer/index.ts src/types.ts src/main.ts
git commit -m "feat(client): add RealtimeQuotes DataLayer source with WebSocket connection"
```

---

## Task 3: Wire StockPanel to Use Realtime Updates

**Files:**
- Modify: `src/plugins/stocks/StockPanel.ts` — subscribe to realtime source

**Step 1: Read current StockPanel to understand its data flow**

The StockPanel subscribes to `'market-quotes'` via DataLayer. We need to also subscribe to `'realtime-quotes'` and merge incoming trade data into the existing quote list.

**Step 2: Add realtime subscription in StockPanel constructor or mount**

After the existing `dataLayer.subscribe('market-quotes', ...)` call, add:

```ts
import { subscribeRealtimeSymbol, onRealtimeConnectionChange } from '@/services/data-layer';

// In the constructor or mount():
private realtimeUnsubs: (() => void)[] = [];

// After market-quotes subscription:
for (const entry of this.watchlist) {
  const unsub = subscribeRealtimeSymbol(entry.symbol);
  this.realtimeUnsubs.push(unsub);
}

// Listen for realtime trade updates
const unsubRealtime = dataLayer.subscribe<any>('realtime-quotes', (quote) => {
  // Find existing quote and update price in-place
  const existing = this.quotes.find(q => q.symbol === quote.symbol);
  if (existing) {
    existing.price = quote.price;
    existing._realtime = true;
    existing._timestamp = quote._timestamp;
    this.renderQuoteRow(existing); // re-render just this row
  }
});
this.realtimeUnsubs.push(unsubRealtime);

// Update LED to show "live" when connected
const unsubConn = onRealtimeConnectionChange((state) => {
  this.setDataBadge(state === 'connected' ? 'LIVE' : 'POLL');
});
this.realtimeUnsubs.push(unsubConn);
```

**Step 3: Add cleanup in `destroy()`**

```ts
public destroy(): void {
  for (const unsub of this.realtimeUnsubs) unsub();
  this.realtimeUnsubs = [];
  super.destroy();
}
```

**Step 4: Type check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/plugins/stocks/StockPanel.ts
git commit -m "feat(stocks): wire StockPanel to realtime WebSocket price updates"
```

---

## Task 4: Price Alert Monitoring

**Files:**
- Modify: `src/services/alert-triggers.ts` — add `startPriceMonitoring()`

**Step 1: Add the price monitoring function**

After the existing `startSignalMonitoring()` function, add:

```ts
let priceCheckInterval: ReturnType<typeof setInterval> | null = null;

function startPriceMonitoring(): void {
  if (priceCheckInterval) return;

  priceCheckInterval = setInterval(() => {
    const triggers = getEnabledTriggers().filter(t => t.type === 'price');
    if (triggers.length === 0) return;

    for (const trigger of triggers) {
      if (!canFire(trigger)) continue;

      // Get latest price from DataLayer (works for both polling and realtime)
      const quotes = dataLayer.getData<StockQuote[]>('market-quotes');
      const realtime = dataLayer.getData<StockQuote>('realtime-quotes');
      
      let price: number | null = null;
      
      // Check realtime first (more current)
      if (realtime && realtime.symbol === trigger.target) {
        price = realtime.price;
      }
      
      // Fallback to polling quotes
      if (price === null && quotes) {
        const quote = quotes.find(q => q.symbol === trigger.target);
        if (quote) price = quote.price;
      }

      if (price === null) continue;

      const threshold = trigger.threshold ?? 0;
      const condition = trigger.condition ?? 'above';

      let shouldFire = false;
      if (condition === 'above' && price > threshold) shouldFire = true;
      if (condition === 'below' && price < threshold) shouldFire = true;

      if (shouldFire) {
        fireAlert({
          ...trigger,
          headline: `${trigger.target} ${condition === 'above' ? 'above' : 'below'} $${threshold} — now $${price.toFixed(2)}`,
          source: 'Price Alert',
        });
      }
    }
  }, 15_000); // Check every 15 seconds
}
```

**Step 2: Add `StockQuote` import if needed**

Check if `StockQuote` is already imported. If not:
```ts
import type { StockQuote } from '@/types';
```

**Step 3: Wire into `startAllAlertMonitoring`**

Find the existing `startAllAlertMonitoring` function and add:
```ts
export function startAllAlertMonitoring(): void {
  startSentimentMonitoring();
  startSignalMonitoring();
  startPriceMonitoring();  // ADD THIS
}
```

**Step 4: Add cleanup in `stopAllAlertMonitoring`**

```ts
export function stopAllAlertMonitoring(): void {
  stopSentimentMonitoring();
  stopSignalMonitoring();  // ADD THIS if not already present
  if (priceCheckInterval) {
    clearInterval(priceCheckInterval);
    priceCheckInterval = null;
  }
}
```

**Step 5: Type check**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/services/alert-triggers.ts
git commit -m "feat(alerts): implement price alert monitoring loop"
```

---

## Task 5: Skeleton Loading for Panels

**Files:**
- Modify: `src/components/Panel.ts` — add `showSkeleton()` method
- Modify: Each plugin panel — call `showSkeleton()` before fetch

**Step 1: Add `showSkeleton()` to Panel base class**

Add after the existing `showLoading()` method:

```ts
public showSkeleton(rows = 3): void {
  this.clearRetry();
  this.errorState = false;

  const skeletonRows = Array.from({ length: rows }, () => `
    <div class="skeleton-row">
      <div class="skeleton-text skeleton-text--long"></div>
      <div class="skeleton-text skeleton-text--short"></div>
      <div class="skeleton-text skeleton-text--medium"></div>
    </div>
  `).join('');

  this.content.innerHTML = `
    <div class="panel-skeleton">
      ${skeletonRows}
    </div>
  `;
}
```

**Step 2: Add skeleton CSS to `main.css`**

```css
.panel-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px;
}

.skeleton-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-text {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg,
    var(--panel-border) 25%,
    var(--panel-hover) 50%,
    var(--panel-border) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-text--long { width: 85%; }
.skeleton-text--medium { width: 60%; }
.skeleton-text--short { width: 40%; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-text {
    animation: none;
    background: var(--panel-border);
  }
}
```

**Step 3: Update panels to use skeleton on initial load**

In each plugin's `refresh()` method, replace the first `this.showLoading()` call with `this.showSkeleton()`. The pattern:

```ts
// Before:
public async refresh(): Promise<void> {
  this.showLoading('Fetching data...');

// After:
public async refresh(): Promise<void> {
  if (!this.hasLoaded) {
    this.showSkeleton(4); // Show skeleton only on first load
    this.hasLoaded = true;
  }
```

Add `private hasLoaded = false;` to each plugin class that gets this treatment.

Do this for the high-visibility panels first:
- `src/plugins/stocks/StockPanel.ts`
- `src/plugins/news/FinancialNewsPlugin.ts`
- `src/plugins/macro/MacroCalendarPlugin.ts`
- `src/plugins/social-sentiment/SocialSentimentPlugin.ts`
- `src/plugins/options-flow/OptionsFlowPlugin.ts`

**Step 4: Type check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/Panel.ts src/plugins/stocks/StockPanel.ts src/plugins/news/FinancialNewsPlugin.ts src/plugins/macro/MacroCalendarPlugin.ts src/plugins/social-sentiment/SocialSentimentPlugin.ts src/plugins/options-flow/OptionsFlowPlugin.ts src/main.css
git commit -m "feat(ui): add skeleton loading placeholders for panel initial load"
```

---

## Task 6: Unsaved Changes Protection in Settings Modal

**Files:**
- Modify: `src/components/SettingsModal.ts` — add dirty tracking and confirmation

**Step 1: Add dirty state tracking**

At the top of the SettingsModal module, add:

```ts
let isDirty = false;

function markDirty(): void {
  isDirty = true;
}

function resetDirty(): void {
  isDirty = false;
}
```

**Step 2: Add input change listeners**

After rendering each tab pane, add event delegation to detect changes:

```ts
// After all panes are rendered:
const overlay = document.getElementById('settingsModal')!;
overlay.addEventListener('input', () => markDirty());
overlay.addEventListener('change', () => markDirty());
```

This captures all input/change events across all 5 tabs.

**Step 3: Modify `closeSettings()` to check dirty state**

```ts
function closeSettings(): void {
  if (isDirty) {
    const confirmed = window.confirm('You have unsaved changes. Discard them?');
    if (!confirmed) return;
  }
  resetDirty();
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
```

**Step 4: Reset dirty flag on save**

In the save button click handler, add `resetDirty()` before closing:

```ts
saveBtn.addEventListener('click', async () => {
  // ... existing save logic ...
  resetDirty();
  closeSettings();
});
```

**Step 5: Add Escape key to close with dirty check**

```ts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlayEl) {
    e.preventDefault();
    closeSettings(); // will check isDirty
  }
});
```

**Step 6: Type check**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/components/SettingsModal.ts
git commit -m "feat(settings): add unsaved changes confirmation on close"
```

---

## Task 7: Global Keyboard Shortcuts

**Files:**
- Modify: `src/main.ts` — add keyboard shortcut listener

**Step 1: Add keyboard shortcuts after the command palette registration**

Find the section where the command palette is initialized. After it, add:

```ts
// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ignore if inside an input/textarea or modal
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
  if (document.querySelector('.modal-overlay.active') || document.querySelector('.settings-overlay')) return;

  const isMod = e.metaKey || e.ctrlKey;

  // Cmd/Ctrl + 1-7: Switch tabs
  if (isMod && e.key >= '1' && e.key <= '7') {
    e.preventDefault();
    const tabButtons = document.querySelectorAll('.app-tab');
    const index = parseInt(e.key) - 1;
    if (tabButtons[index]) {
      (tabButtons[index] as HTMLElement).click();
    }
    return;
  }

  // Cmd/Ctrl + Shift + R: Toggle layout mode (existing)
  // Already handled elsewhere, skip

  // R: Refresh current tab's panels
  if (e.key === 'r' && !isMod) {
    e.preventDefault();
    // Trigger refresh for all visible panels on current tab
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
      const panels = activeTab.querySelectorAll('[data-panel]');
      panels.forEach(panel => {
        const panelId = panel.getAttribute('data-panel');
        if (panelId) {
          // Find panel instance and call refresh
          const panelInstance = (window as any).__panelInstances?.[panelId];
          if (panelInstance?.refresh) {
            panelInstance.refresh();
          }
        }
      });
    }
    return;
  }

  // ?: Show keyboard shortcuts help
  if (e.key === '?' && !isMod) {
    e.preventDefault();
    showShortcutsHelp();
    return;
  }

  // /: Focus command palette search (opens if not open)
  if (e.key === '/' && !isMod) {
    e.preventDefault();
    // Open command palette if not already open
    if (!document.querySelector('.command-palette-overlay')) {
      document.dispatchEvent(new CustomEvent('mdm-command-palette-toggle'));
    }
    return;
  }
});
```

**Step 2: Add shortcuts help overlay function**

```ts
function showShortcutsHelp(): void {
  const existing = document.getElementById('shortcutsHelp');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'shortcutsHelp';
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="modal-close" id="shortcutsClose">&times;</button>
      </div>
      <div class="modal-body" style="display: grid; gap: 8px;">
        <div class="shortcut-row"><kbd>Cmd/Ctrl + K</kbd> <span>Command palette</span></div>
        <div class="shortcut-row"><kbd>Cmd/Ctrl + 1-7</kbd> <span>Switch tabs</span></div>
        <div class="shortcut-row"><kbd>R</kbd> <span>Refresh current tab</span></div>
        <div class="shortcut-row"><kbd>/</kbd> <span>Open command palette</span></div>
        <div class="shortcut-row"><kbd>?</kbd> <span>Show this help</span></div>
        <div class="shortcut-row"><kbd>Esc</kbd> <span>Close modal/palette</span></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#shortcutsClose')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
```

**Step 3: Add CSS for shortcuts overlay**

```css
.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--panel-border);
}

.shortcut-row kbd {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.shortcut-row span {
  color: var(--text-primary);
  font-size: 13px;
}
```

**Step 4: Expose panel instances globally for refresh shortcut**

In `main.ts`, where panels are instantiated, add them to a global map:

```ts
// After panel instantiation:
(window as any).__panelInstances = PANEL_BY_ID;
```

**Step 5: Type check**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/main.ts src/main.css
git commit -m "feat(shortcuts): add global keyboard shortcuts with help overlay"
```

---

## Task 8: Final Verification

**Step 1: Full type check (both configs)**

```bash
npm run type:check
```
Expected: no errors.

**Step 2: Lint**

```bash
npm run lint
```
Expected: no errors (or only pre-existing warnings).

**Step 3: Format check**

```bash
npm run format:check
```

**Step 4: Run tests**

```bash
npm run test
```
Expected: all tests pass.

**Step 5: Build**

```bash
npm run build
```
Expected: build succeeds.

**Step 6: Manual smoke test**

```bash
npm run dev
```
- Open `http://localhost:5173`
- Verify: Stocks panel shows "LIVE" badge when WebSocket connects
- Verify: Prices update in real-time without page refresh
- Verify: Skeleton loading appears on first panel load
- Verify: Create a price alert in Settings, confirm it fires
- Verify: Close Settings with changes → confirmation dialog appears
- Verify: Press `?` → shortcuts overlay appears
- Verify: Press `Cmd+1-7` → tabs switch
- Verify: Press `R` → panels refresh

**Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address review feedback from Phase 1 implementation"
```
