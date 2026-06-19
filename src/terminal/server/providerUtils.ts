export function getCached<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function setCached<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T, ttlMs: number) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

export async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "blmtrm/1.0",
      Accept: "text/plain,text/csv,application/xml,text/xml,application/rss+xml,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}
