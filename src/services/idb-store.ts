import { DBStore } from '@/utils/db-store';

const MIGRATED_KEY = 'mdm-idb-migrated';

const db = new DBStore('my-daily-monitor', 1, [
  { name: 'strategies', keyPath: 'id' },
  { name: 'trades', keyPath: 'id' },
  { name: 'playbooks', keyPath: 'id' },
  { name: 'backtests', keyPath: 'id' },
  { name: 'habits', keyPath: 'id' },
  { name: 'habit-logs', keyPath: 'id', indexes: [{ name: 'by-habit', keyPath: 'habitId' }] },
  { name: 'health-metrics', keyPath: 'id' },
  { name: 'routines', keyPath: 'id' },
  { name: 'checkins', keyPath: 'id', indexes: [{ name: 'by-date', keyPath: 'date' }] },
]);

const isIndexedDBAvailable = (): boolean => !!indexedDB;

async function ensureMigrated(): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  if (localStorage.getItem(MIGRATED_KEY)) return;
  try {
    await db.open();
    const migrations: [string, string][] = [
      ['mdm-strategy-strategies', 'strategies'],
      ['mdm-strategy-trades', 'trades'],
      ['mdm-strategy-playbooks', 'playbooks'],
      ['mdm-strategy-backtests', 'backtests'],
      ['mdm-habits', 'habits'],
      ['mdm-habit-logs', 'habit-logs'],
      ['mdm-health-metrics', 'health-metrics'],
      ['mdm-routines', 'routines'],
      ['mdm-checkins', 'checkins'],
    ];
    for (const [lsKey, storeName] of migrations) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          const existing = await db.getAll(storeName);
          if (existing.length === 0) {
            for (const item of items) await db.put(storeName, item);
          }
        }
      } catch {}
    }
    localStorage.setItem(MIGRATED_KEY, '1');
  } catch {}
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  if (!isIndexedDBAvailable()) return [];
  await ensureMigrated();
  try {
    return await db.getAll<T>(storeName);
  } catch {
    return [];
  }
}

export async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  if (!isIndexedDBAvailable()) return undefined;
  await ensureMigrated();
  try {
    return await db.get<T>(storeName, key);
  } catch {
    return undefined;
  }
}

export async function idbPut<T>(storeName: string, value: T): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  await ensureMigrated();
  try {
    await db.put(storeName, value);
  } catch {}
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  await ensureMigrated();
  try {
    await db.delete(storeName, key);
  } catch {}
}

export async function idbQueryByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  if (!isIndexedDBAvailable()) return [];
  await ensureMigrated();
  try {
    return await db.queryByIndex<T>(storeName, indexName, value);
  } catch {
    return [];
  }
}
