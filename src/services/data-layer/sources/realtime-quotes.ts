/**
 * Realtime quotes data source — receives live trade updates via WebSocket.
 *
 * Connects to the server's `/ws/finnhub` WebSocket proxy, subscribes to
 * trade channels for requested symbols, and publishes individual quote
 * updates through the DataLayer.
 */

import { dataLayer } from '../DataLayer';
import type { StockQuote } from './market-quotes';

export const REALTIME_QUOTES_SOURCE_ID = 'realtime-quotes';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type ConnectionChangeCallback = (state: ConnectionState) => void;

let ws: WebSocket | null = null;
let reconnectDelay = 1_000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;

const subscribedSymbols = new Set<string>();
const connectionListeners = new Set<ConnectionChangeCallback>();

// ──────────────────────────────────────────────
//  Connection state
// ──────────────────────────────────────────────

function notifyConnectionListeners(state: ConnectionState): void {
  for (const cb of connectionListeners) {
    try {
      cb(state);
    } catch (err) {
      console.error('[RealtimeQuotes] Connection listener error:', err);
    }
  }
}

function getConnectionState(): ConnectionState {
  if (!ws) return 'disconnected';
  if (ws.readyState === WebSocket.CONNECTING) return 'connecting';
  if (ws.readyState === WebSocket.OPEN) return 'connected';
  return 'disconnected';
}

// ──────────────────────────────────────────────
//  WebSocket lifecycle
// ──────────────────────────────────────────────

export function initRealtimeQuotes(): void {
  if (ws) return;
  intentionalClose = false;
  connect();
}

export function disconnectRealtime(): void {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  subscribedSymbols.clear();
  notifyConnectionListeners('disconnected');
}

function connect(): void {
  if (ws) return;

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws/finnhub`;

  notifyConnectionListeners('connecting');
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1_000;
    notifyConnectionListeners('connected');

    // Re-subscribe to all tracked symbols
    for (const symbol of subscribedSymbols) {
      ws!.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
      if (msg.type === 'trade' && Array.isArray(msg.data)) {
        for (const trade of msg.data) {
          const quote: StockQuote = {
            symbol: trade.s,
            name: '',
            price: trade.p,
            change: null,
            changePercent: null,
            high: null,
            low: null,
            sparkline: [],
            _realtime: true,
            _timestamp: trade.t || Date.now(),
          };
          dataLayer.publish(REALTIME_QUOTES_SOURCE_ID, quote);
        }
      }
    } catch {
      /* ignore malformed messages */
    }
  };

  ws.onclose = () => {
    ws = null;
    notifyConnectionListeners('disconnected');
    if (!intentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
    connect();
  }, reconnectDelay);
}

// ──────────────────────────────────────────────
//  DataLayer registration
// ──────────────────────────────────────────────

/**
 * Register realtime quotes as a DataLayer source.
 * Must be called before `initRealtimeQuotes()`.
 */
export function registerRealtimeQuotesSource(): void {
  dataLayer.registerSource<StockQuote>({
    id: REALTIME_QUOTES_SOURCE_ID,
    fetch: async () =>
      dataLayer.getData<StockQuote>(REALTIME_QUOTES_SOURCE_ID) ?? ({} as StockQuote),
    cache: {
      ttlMs: 0, // no cache — data is pushed via WebSocket
    },
  });
}

// ──────────────────────────────────────────────
//  Public API
// ──────────────────────────────────────────────

/**
 * Subscribe to realtime trade updates for a symbol.
 * Returns an unsubscribe function that sends the unsubscribe message.
 */
export function subscribeRealtimeSymbol(symbol: string): () => void {
  subscribedSymbols.add(symbol);

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', symbol }));
  }

  return () => {
    subscribedSymbols.delete(symbol);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  };
}

/**
 * Register a listener for WebSocket connection state changes.
 * Returns an unsubscribe function.
 */
export function onRealtimeConnectionChange(callback: ConnectionChangeCallback): () => void {
  connectionListeners.add(callback);
  // Deliver current state immediately
  callback(getConnectionState());
  return () => {
    connectionListeners.delete(callback);
  };
}
