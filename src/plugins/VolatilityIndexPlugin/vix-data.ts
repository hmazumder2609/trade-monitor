export interface VixSnapshot {
  price: number;
  change: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  previousClose: number;
  timestamp: string;
}

export async function fetchVixSnapshot(): Promise<VixSnapshot> {
  const resp = await fetch('/api/stocks?symbol=CBOE:VIX');
  if (!resp.ok) throw new Error(`VIX fetch failed: ${resp.status}`);
  const data = await resp.json();
  return {
    price: data.c ?? 0,
    change: (data.c ?? 0) - (data.pc ?? 0),
    changePercent: (((data.c ?? 0) - (data.pc ?? 1)) / (data.pc ?? 1)) * 100,
    high52w: data.h ?? 0,
    low52w: data.l ?? 0,
    previousClose: data.pc ?? 0,
    timestamp: new Date().toISOString(),
  };
}
