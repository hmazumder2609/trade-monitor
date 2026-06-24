/**
 * DataLayer — central data bus for cross-panel data sharing.
 *
 * Panels register data sources, subscribe to changes, and get deduplicated fetches.
 * The DataLayer caches data and fans out updates to all subscribers.
 */

import type {
  DataSource,
  DataSourceConfig,
  Subscriber,
  DataMetadata,
  DataLayerEvent,
} from './types';

type SymbolChangeCallback = (symbol: string) => void;
type EventCallback = (event: DataLayerEvent) => void;

export class DataLayer {
  private static instance: DataLayer | null = null;

  private sources = new Map<string, DataSource<unknown>>();
  private symbolListeners = new Set<SymbolChangeCallback>();
  private eventListeners = new Set<EventCallback>();
  private selectedSymbol: string | null = null;

  private constructor() {}

  static getInstance(): DataLayer {
    if (!DataLayer.instance) {
      DataLayer.instance = new DataLayer();
    }
    return DataLayer.instance;
  }

  // ──────────────────────────────────────────────
  //  Source management
  // ──────────────────────────────────────────────

  registerSource<T>(config: DataSourceConfig<T>): void {
    if (this.sources.has(config.id)) {
      console.warn(`[DataLayer] Source "${config.id}" already registered — skipping.`);
      return;
    }

    const source: DataSource<T> = {
      ...config,
      cachedData: null,
      lastFetchAt: 0,
      inflight: null,
      subscribers: new Set(),
    };

    this.sources.set(config.id, source as DataSource<unknown>);
    this.emit({ type: 'source-registered', sourceId: config.id });
  }

  unregisterSource(id: string): void {
    this.sources.delete(id);
  }

  hasSource(id: string): boolean {
    return this.sources.has(id);
  }

  // ──────────────────────────────────────────────
  //  Subscription
  // ──────────────────────────────────────────────

  subscribe<T>(sourceId: string, callback: Subscriber<T>): () => void {
    const source = this.sources.get(sourceId) as DataSource<T> | undefined;
    if (!source) {
      console.warn(`[DataLayer] Cannot subscribe to unknown source "${sourceId}".`);
      return () => {};
    }

    source.subscribers.add(callback as Subscriber<unknown>);

    // If we already have cached data, deliver it immediately
    if (source.cachedData !== null) {
      callback(source.cachedData, { source: 'cache', timestamp: source.lastFetchAt });
    }

    return () => {
      source.subscribers.delete(callback as Subscriber<unknown>);
    };
  }

  // ──────────────────────────────────────────────
  //  Data access
  // ──────────────────────────────────────────────

  /**
   * Get cached data synchronously. Returns null if not yet fetched.
   */
  getData<T>(sourceId: string): T | null {
    const source = this.sources.get(sourceId) as DataSource<T> | undefined;
    return (source?.cachedData as T) ?? null;
  }

  /**
   * Fetch fresh data from a source. Deduplicates concurrent calls.
   * Returns the data and notifies all subscribers.
   */
  async fetch<T>(sourceId: string): Promise<T | null> {
    const source = this.sources.get(sourceId) as DataSource<T> | undefined;
    if (!source) {
      console.warn(`[DataLayer] Cannot fetch unknown source "${sourceId}".`);
      return null;
    }

    // Check cache freshness
    if (
      source.cache &&
      source.cache.ttlMs > 0 &&
      source.cachedData !== null &&
      Date.now() - source.lastFetchAt < source.cache.ttlMs
    ) {
      return source.cachedData;
    }

    // Deduplicate in-flight requests
    if (source.inflight) {
      return source.inflight as Promise<T>;
    }

    const fetchPromise = this.doFetch(source);
    source.inflight = fetchPromise;

    try {
      const data = await fetchPromise;
      return data;
    } finally {
      source.inflight = null;
    }
  }

  /**
   * Force-publish data to all subscribers (e.g., after local mutations).
   */
  publish<T>(sourceId: string, data: T): void {
    const source = this.sources.get(sourceId) as DataSource<T> | undefined;
    if (!source) return;

    source.cachedData = data;
    source.lastFetchAt = Date.now();

    const metadata: DataMetadata = { source: 'publish', timestamp: Date.now() };
    for (const subscriber of source.subscribers) {
      try {
        (subscriber as Subscriber<T>)(data, metadata);
      } catch (err) {
        console.error(`[DataLayer] Subscriber error on "${sourceId}":`, err);
      }
    }
  }

  // ──────────────────────────────────────────────
  //  Cross-panel symbol selection
  // ──────────────────────────────────────────────

  selectSymbol(symbol: string): void {
    if (this.selectedSymbol === symbol) return;
    this.selectedSymbol = symbol;

    for (const cb of this.symbolListeners) {
      try {
        cb(symbol);
      } catch (err) {
        console.error('[DataLayer] Symbol listener error:', err);
      }
    }
  }

  getSelectedSymbol(): string | null {
    return this.selectedSymbol;
  }

  onSymbolChange(callback: SymbolChangeCallback): () => void {
    this.symbolListeners.add(callback);
    return () => {
      this.symbolListeners.delete(callback);
    };
  }

  // ──────────────────────────────────────────────
  //  Event bus
  // ──────────────────────────────────────────────

  onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  private emit(event: DataLayerEvent): void {
    for (const cb of this.eventListeners) {
      try {
        cb(event);
      } catch (err) {
        console.error('[DataLayer] Event listener error:', err);
      }
    }
  }

  // ──────────────────────────────────────────────
  //  Private helpers
  // ──────────────────────────────────────────────

  private async doFetch<T>(source: DataSource<T>): Promise<T> {
    try {
      let data: T = await source.fetch();

      if (source.transform) {
        data = source.transform(data);
      }

      source.cachedData = data;
      source.lastFetchAt = Date.now();

      const metadata: DataMetadata = { source: 'fetch', timestamp: Date.now() };
      for (const subscriber of source.subscribers) {
        try {
          (subscriber as Subscriber<T>)(data, metadata);
        } catch (err) {
          console.error(`[DataLayer] Subscriber error on "${source.id}":`, err);
        }
      }

      this.emit({ type: 'data-changed', sourceId: source.id, data });
      return data;
    } catch (err) {
      console.error(`[DataLayer] Fetch failed for "${source.id}":`, err);
      throw err;
    }
  }

  // ──────────────────────────────────────────────
  //  Debug / introspection
  // ──────────────────────────────────────────────

  getSourceIds(): string[] {
    return Array.from(this.sources.keys());
  }

  getSubscriberCount(sourceId: string): number {
    return this.sources.get(sourceId)?.subscribers.size ?? 0;
  }

  getCacheInfo(sourceId: string): { hasData: boolean; lastFetchAt: number; ageMs: number } | null {
    const source = this.sources.get(sourceId);
    if (!source) return null;
    return {
      hasData: source.cachedData !== null,
      lastFetchAt: source.lastFetchAt,
      ageMs: source.lastFetchAt > 0 ? Date.now() - source.lastFetchAt : Infinity,
    };
  }
}

/** Singleton instance — import this, not the class. */
export const dataLayer = DataLayer.getInstance();
