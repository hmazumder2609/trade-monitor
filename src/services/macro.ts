import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface MacroObservation {
  date: string;
  value: number;
}

export interface MacroSeries {
  series: string;
  name: string;
  observations: MacroObservation[];
}

export interface MacroIndicator {
  series: string;
  name: string;
  value: number | null;
  date: string | null;
}

export interface YieldCurvePoint {
  term: string;
  value: number | null;
  date: string | null;
}

export interface YieldCurveData {
  yields: YieldCurvePoint[];
  spreads: Record<string, number | null>;
}

const macroBreaker = createCircuitBreaker<MacroSeries>({
  name: 'Macro',
  cacheTtlMs: 15 * 60_000,
});

export async function fetchMacroSeries(seriesId: string, limit = 90): Promise<MacroSeries> {
  return macroBreaker.execute(
    async () => {
      const resp = await fetch(`/api/macro?action=series&series=${seriesId}&limit=${limit}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { series: seriesId, name: seriesId, observations: [] }
  );
}

const indicatorsBreaker = createCircuitBreaker<{ indicators: MacroIndicator[] }>({
  name: 'MacroIndicators',
  cacheTtlMs: 15 * 60_000,
});

export async function fetchMacroIndicators(series?: string[]): Promise<MacroIndicator[]> {
  const s = series || ['GDP', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'PCE'];
  return indicatorsBreaker.execute(async () => {
    const resp = await fetch(`/api/macro?action=indicators&series=${s.join(',')}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.indicators || [];
  }, []);
}

const yieldBreaker = createCircuitBreaker<YieldCurveData>({
  name: 'YieldCurve',
  cacheTtlMs: 15 * 60_000,
});

export async function fetchYieldCurve(): Promise<YieldCurveData> {
  return yieldBreaker.execute(
    async () => {
      const resp = await fetch('/api/macro?action=yield-curve');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { yields: [], spreads: {} }
  );
}

const historyBreaker = createCircuitBreaker<MacroSeries>({
  name: 'MacroHistory',
  cacheTtlMs: 15 * 60_000,
});

export async function fetchMacroHistory(seriesId: string, months = 12): Promise<MacroSeries> {
  return historyBreaker.execute(
    async () => {
      const resp = await fetch(`/api/macro?action=history&series=${seriesId}&months=${months}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { series: seriesId, name: seriesId, observations: [] }
  );
}
