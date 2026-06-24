/** Data Layer types — shared data sources for cross-panel data sharing. */

export interface CacheConfig {
  /** Time-to-live in milliseconds. 0 = no cache. */
  ttlMs: number;
}

export type Subscriber<T> = (data: T, metadata?: DataMetadata) => void;

export interface DataMetadata {
  /** Source of the data update. */
  source: 'fetch' | 'cache' | 'publish' | 'local';
  /** Timestamp of the data. */
  timestamp: number;
}

export interface DataSourceConfig<T> {
  /** Unique identifier for this data source. */
  id: string;
  /** Fetch function — called to get fresh data. */
  fetch: () => Promise<T>;
  /** Cache configuration. */
  cache?: CacheConfig;
  /** Optional transform applied before caching. */
  transform?: (raw: T) => T;
}

export interface DataSource<T> extends DataSourceConfig<T> {
  /** Cached data (null if never fetched). */
  cachedData: T | null;
  /** Timestamp of last fetch. */
  lastFetchAt: number;
  /** In-flight fetch promise (for deduplication). */
  inflight: Promise<T> | null;
  /** Active subscribers. */
  subscribers: Set<Subscriber<T>>;
}

export interface DataLayerEvent<T = unknown> {
  type: 'data-changed' | 'symbol-selected' | 'source-registered';
  sourceId?: string;
  data?: T;
  symbol?: string;
}
