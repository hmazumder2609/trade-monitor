/**
 * Watchlist data source — the canonical source of truth for tracked symbols.
 *
 * Stores in localStorage under `mdm-watchlist-v1`.
 * Falls back to legacy `UserPreferences.stockWatchlist` on first run (migration).
 */

import { dataLayer } from '../DataLayer';

const STORAGE_KEY = 'mdm-watchlist-v1';
const LEGACY_KEY = 'mdm-preferences-v1';

export interface WatchlistEntry {
  symbol: string;
  name?: string;
  /** Optional tags for filtering (e.g., 'tech', 'crypto', 'watch'). */
  tags?: string[];
  /** When the symbol was added. */
  addedAt?: number;
}

const DEFAULT_WATCHLIST: WatchlistEntry[] = [
  { symbol: 'AAPL', name: 'Apple', tags: ['tech'], addedAt: 0 },
  { symbol: 'MSFT', name: 'Microsoft', tags: ['tech'], addedAt: 0 },
  { symbol: 'GOOGL', name: 'Alphabet', tags: ['tech'], addedAt: 0 },
  { symbol: 'AMZN', name: 'Amazon', tags: ['tech'], addedAt: 0 },
  { symbol: 'TSLA', name: 'Tesla', tags: ['tech', 'ev'], addedAt: 0 },
  { symbol: 'NVDA', name: 'NVIDIA', tags: ['tech', 'ai'], addedAt: 0 },
  { symbol: 'META', name: 'Meta', tags: ['tech'], addedAt: 0 },
];

// ──────────────────────────────────────────────
//  localStorage helpers
// ──────────────────────────────────────────────

function readStorage(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Migration: read from legacy preferences
  return migrateFromLegacy();
}

function writeStorage(entries: WatchlistEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function migrateFromLegacy(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [...DEFAULT_WATCHLIST];

    const prefs = JSON.parse(raw);
    if (Array.isArray(prefs.stockWatchlist) && prefs.stockWatchlist.length > 0) {
      const migrated: WatchlistEntry[] = prefs.stockWatchlist.map(
        (w: { symbol: string; name?: string }) => ({
          symbol: w.symbol,
          name: w.name,
          tags: [],
          addedAt: Date.now(),
        })
      );
      writeStorage(migrated);
      return migrated;
    }
  } catch {}

  return [...DEFAULT_WATCHLIST];
}

// ──────────────────────────────────────────────
//  Public API (used by panels directly)
// ──────────────────────────────────────────────

/**
 * Get all watchlist entries (sync, from localStorage).
 */
export function getWatchlist(): WatchlistEntry[] {
  return readStorage();
}

/**
 * Get just the symbol strings.
 */
export function getWatchlistSymbols(): string[] {
  return getWatchlist().map(w => w.symbol);
}

/**
 * Add a symbol to the watchlist. Returns false if already present.
 */
export function addToWatchlist(symbol: string, name?: string, tags?: string[]): boolean {
  const entries = getWatchlist();
  if (entries.some(e => e.symbol === symbol)) return false;

  entries.push({ symbol, name, tags: tags || [], addedAt: Date.now() });
  writeStorage(entries);

  // Publish update through DataLayer
  dataLayer.publish(WATCHLIST_SOURCE_ID, entries);
  return true;
}

/**
 * Remove a symbol from the watchlist. Returns false if not found.
 */
export function removeFromWatchlist(symbol: string): boolean {
  const entries = getWatchlist();
  const idx = entries.findIndex(e => e.symbol === symbol);
  if (idx === -1) return false;

  entries.splice(idx, 1);
  writeStorage(entries);

  dataLayer.publish(WATCHLIST_SOURCE_ID, entries);
  return true;
}

/**
 * Update tags for a symbol.
 */
export function updateWatchlistTags(symbol: string, tags: string[]): void {
  const entries = getWatchlist();
  const entry = entries.find(e => e.symbol === symbol);
  if (!entry) return;

  entry.tags = tags;
  writeStorage(entries);
  dataLayer.publish(WATCHLIST_SOURCE_ID, entries);
}

/**
 * Check if a symbol is in the watchlist.
 */
export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().some(e => e.symbol === symbol);
}

export function setWatchlist(entries: { symbol: string; name?: string }[]): void {
  writeStorage(entries);
  dataLayer.publish(WATCHLIST_SOURCE_ID, entries);
}

// ──────────────────────────────────────────────
//  DataLayer registration
// ──────────────────────────────────────────────

export const WATCHLIST_SOURCE_ID = 'watchlist';

/**
 * Register the watchlist as a DataLayer source.
 * Call once at app startup (before panels that depend on it).
 */
export function registerWatchlistSource(): void {
  dataLayer.registerSource<WatchlistEntry[]>({
    id: WATCHLIST_SOURCE_ID,
    fetch: async () => readStorage(),
    cache: {
      ttlMs: 300_000, // 5min — localStorage is always fresh, this is for cache semantics
    },
  });

  // Publish initial data immediately (no fetch needed — it's local)
  dataLayer.publish(WATCHLIST_SOURCE_ID, readStorage());
}

// ──────────────────────────────────────────────
//  Bridge to terminal subproject
// ──────────────────────────────────────────────

/**
 * Push watchlist to the terminal subproject via API bridge.
 * Called after any watchlist mutation.
 */
export function syncWatchlistToBridge(): void {
  const entries = getWatchlist();
  const payload = entries.map(e => ({ symbol: e.symbol, name: e.name }));

  fetch('/api/bridge/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchlist: payload }),
  }).catch(() => {
    // Bridge is best-effort — terminal may not be running
  });
}
