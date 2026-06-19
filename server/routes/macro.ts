import type { IncomingHttpHeaders } from 'node:http';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 15 * 60_000;

const SERIES_INFO: Record<string, string> = {
  GDP: 'Gross Domestic Product',
  CPIAUCSL: 'Consumer Price Index',
  UNRATE: 'Unemployment Rate',
  FEDFUNDS: 'Federal Funds Rate',
  PCE: 'Personal Consumption Expenditures',
  DGS2: '2-Year Treasury Yield',
  DGS5: '5-Year Treasury Yield',
  DGS10: '10-Year Treasury Yield',
  DGS30: '30-Year Treasury Yield',
  DGS3MO: '3-Month Treasury Yield',
  T10Y2Y: '10-Year Treasury Constant Maturity Minus 2-Year',
  T10Y3M: '10-Year Treasury Constant Maturity Minus 3-Month',
  NFPA: 'Nonfarm Payrolls',
  PAYEMS: 'Nonfarm Payrolls',
  PCECC96: 'Real Personal Consumption Expenditures',
};

const YIELD_SPREADS = ['T10Y2Y', 'T10Y3M'];

async function fetchFredSeries(seriesId: string, apiKey: string, limit = 90) {
  const resp = await fetch(
    `${FRED_BASE}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`,
    { headers: { 'User-Agent': 'MyDailyMonitor/1.0' } }
  );
  if (!resp.ok) throw new Error(`FRED HTTP ${resp.status}`);
  const data = (await resp.json()) as any;
  if (data.error) throw new Error(data.error_message || 'FRED API error');
  return (data.observations || [])
    .filter((o: any) => o.value !== '.' && o.value !== '')
    .map((o: any) => ({
      date: o.date,
      value: parseFloat(o.value),
    }));
}

export async function handleMacroRequest(
  query: Record<string, string>,
  _body: string,
  _headers: IncomingHttpHeaders
): Promise<unknown> {
  const apiKey = process.env.FRED_API_KEY || '';
  if (!apiKey) return { error: 'FRED_API_KEY not configured' };

  const action = query.action || 'series';

  if (action === 'series') {
    const seriesId = (query.series || '').toUpperCase().trim();
    if (!seriesId) return { error: 'Missing series parameter' };
    const limit = parseInt(query.limit || '90', 10);

    const cacheKey = `fred:${seriesId}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    const observations = await fetchFredSeries(seriesId, apiKey, limit);
    const response = {
      series: seriesId,
      name: SERIES_INFO[seriesId] || seriesId,
      observations,
    };
    cache.set(cacheKey, { data: response, ts: Date.now() });
    return response;
  }

  if (action === 'indicators') {
    const seriesList = (query.series || 'GDP,CPIAUCSL,UNRATE,FEDFUNDS,PCE')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const results = await Promise.allSettled(
      seriesList.map(async s => {
        const cacheKey = `fred:${s}:1`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
        const obs = await fetchFredSeries(s, apiKey, 1);
        const latest = obs[0];
        const response = {
          series: s,
          name: SERIES_INFO[s] || s,
          value: latest?.value ?? null,
          date: latest?.date ?? null,
        };
        cache.set(cacheKey, { data: response, ts: Date.now() });
        return response;
      })
    );

    return {
      indicators: results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value),
    };
  }

  if (action === 'yield-curve') {
    const points = ['DGS3MO', 'DGS2', 'DGS5', 'DGS10', 'DGS30'];
    const results = await Promise.allSettled(
      points.map(async s => {
        const cacheKey = `fred:${s}:1`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
        const obs = await fetchFredSeries(s, apiKey, 1);
        const latest = obs[0];
        const response = {
          term:
            s === 'DGS3MO'
              ? '3m'
              : s === 'DGS2'
                ? '2y'
                : s === 'DGS5'
                  ? '5y'
                  : s === 'DGS10'
                    ? '10y'
                    : '30y',
          value: latest?.value ?? null,
          date: latest?.date ?? null,
        };
        cache.set(cacheKey, { data: response, ts: Date.now() });
        return response;
      })
    );

    const yields = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    let spread2s10s: number | null = null;
    let spread3m10s: number | null = null;
    const y2 = yields.find((y: any) => y.term === '2y')?.value;
    const y10 = yields.find((y: any) => y.term === '10y')?.value;
    const y3m = yields.find((y: any) => y.term === '3m')?.value;
    if (y2 != null && y10 != null) spread2s10s = y10 - y2;
    if (y3m != null && y10 != null) spread3m10s = y10 - y3m;

    return { yields, spreads: { '2s10s': spread2s10s, '3m10s': spread3m10s } };
  }

  if (action === 'history') {
    const seriesId = (query.series || '').toUpperCase().trim();
    if (!seriesId) return { error: 'Missing series parameter' };
    const months = parseInt(query.months || '12', 10);
    const limit = months * 31;

    const cacheKey = `fred:${seriesId}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    const observations = await fetchFredSeries(seriesId, apiKey, limit);
    const response = {
      series: seriesId,
      name: SERIES_INFO[seriesId] || seriesId,
      observations,
    };
    cache.set(cacheKey, { data: response, ts: Date.now() });
    return response;
  }

  return { error: 'Unknown action' };
}
