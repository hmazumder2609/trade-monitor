/**
 * Finnhub WebSocket proxy — bridges browser clients to the Finnhub WS stream.
 *
 * Connects to wss://ws.finnhub.io, subscribes to trade channels for requested
 * symbols, and relays trade messages to connected browser clients.
 */
import WebSocket from 'ws';
import { logger } from '../logger.js';

const FINNHUB_WS_URL = 'wss://ws.finnhub.io';
const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;

interface ClientInfo {
  clients: Set<WebSocket>;
  symbols: Set<string>;
}

export function createFinnhubBridge(apiKey: string) {
  let finnhubWs: WebSocket | null = null;
  let reconnectDelay = RECONNECT_BASE_DELAY;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const clientMap = new Map<string, ClientInfo>();

  function connect() {
    if (finnhubWs?.readyState === WebSocket.OPEN) return;

    finnhubWs = new WebSocket(`${FINNHUB_WS_URL}?token=${apiKey}`);

    finnhubWs.on('open', () => {
      logger.info('[FinnhubWS] Connected');
      reconnectDelay = RECONNECT_BASE_DELAY;
      startHeartbeat();
      for (const [, info] of clientMap) {
        for (const sym of info.symbols) {
          finnhubWs!.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
        }
      }
    });

    finnhubWs.on('message', (raw: WebSocket.Data) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          const bySymbol = new Map<string, any[]>();
          for (const trade of msg.data) {
            const sym = trade.s;
            if (!bySymbol.has(sym)) bySymbol.set(sym, []);
            bySymbol.get(sym)!.push(trade);
          }

          for (const [, info] of clientMap) {
            const relevantTrades: any[] = [];
            for (const sym of info.symbols) {
              if (bySymbol.has(sym)) {
                relevantTrades.push(...bySymbol.get(sym)!);
              }
            }
            if (relevantTrades.length > 0 && info.clients.size > 0) {
              const payload = JSON.stringify({ type: 'trade', data: relevantTrades });
              for (const client of info.clients) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(payload);
                }
              }
            }
          }
        }
      } catch {
        /* ignore malformed messages */
      }
    });

    finnhubWs.on('close', () => {
      logger.warn('[FinnhubWS] Disconnected, reconnecting...');
      stopHeartbeat();
      scheduleReconnect();
    });

    finnhubWs.on('error', err => {
      logger.error('[FinnhubWS] Error:', err);
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
    const clientId = (clientWs as any)._wsId as string;
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, { clients: new Set(), symbols: new Set() });
    }
    const info = clientMap.get(clientId)!;
    const wasNew = !info.symbols.has(symbol);
    info.clients.add(clientWs);
    info.symbols.add(symbol);

    if (wasNew && finnhubWs?.readyState === WebSocket.OPEN) {
      finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  function unsubscribe(symbol: string, clientWs: WebSocket) {
    const clientId = (clientWs as any)._wsId as string;
    const info = clientMap.get(clientId);
    if (info) {
      info.clients.delete(clientWs);
      info.symbols.delete(symbol);
      if (info.symbols.size === 0) {
        clientMap.delete(clientId);
      }
    }

    let stillNeeded = false;
    for (const [, otherInfo] of clientMap) {
      if (otherInfo.symbols.has(symbol)) {
        stillNeeded = true;
        break;
      }
    }
    if (!stillNeeded && finnhubWs?.readyState === WebSocket.OPEN) {
      finnhubWs.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  }

  function removeClient(clientWs: WebSocket) {
    const clientId = (clientWs as any)._wsId as string;
    const info = clientMap.get(clientId);
    if (info) {
      for (const sym of info.symbols) {
        let stillNeeded = false;
        for (const [otherId, otherInfo] of clientMap) {
          if (otherId !== clientId && otherInfo.symbols.has(sym)) {
            stillNeeded = true;
            break;
          }
        }
        if (!stillNeeded && finnhubWs?.readyState === WebSocket.OPEN) {
          finnhubWs.send(JSON.stringify({ type: 'unsubscribe', symbol: sym }));
        }
      }
      clientMap.delete(clientId);
    }
  }

  function shutdown() {
    logger.info('[FinnhubWS] Shutting down');
    stopHeartbeat();
    finnhubWs?.close();
    clientMap.clear();
  }

  return { connect, subscribe, unsubscribe, removeClient, shutdown };
}
