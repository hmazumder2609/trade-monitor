import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DataStatusBadge from "@/components/data/DataStatusBadge";
import { formatPrice, pctClass } from "@/lib/finance";
import { getAllowedIntervals, normalizeComparisonSeries, supportsIntradayCharts, type ChartInterval } from "@/lib/chartSeries";
import { useOHLCV, useQuote } from "@/lib/useFinance";

interface Props {
  symbol: string;
  onSymbol: (sym: string) => void;
}

const RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y", "2Y"] as const;
const INDICATORS = ["none", "SMA20", "SMA50", "RSI"] as const;
const COMPARISON_COLORS = ["hsl(38,95%,55%)", "hsl(186,80%,55%)", "hsl(265,70%,65%)"];

function computeSMA(data: Array<{ close: number }>, period: number): (number | null)[] {
  return data.map((_, index) => {
    if (index < period - 1) return null;
    const slice = data.slice(index - period + 1, index + 1);
    return slice.reduce((sum, point) => sum + point.close, 0) / period;
  });
}

function computeRSI(data: Array<{ close: number }>, period = 14): (number | null)[] {
  const gains: number[] = [];
  const losses: number[] = [];
  for (let index = 1; index < data.length; index++) {
    const delta = data[index].close - data[index - 1].close;
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? -delta : 0);
  }

  const result: (number | null)[] = [null];
  for (let index = 0; index < gains.length; index++) {
    if (index < period - 1) {
      result.push(null);
      continue;
    }

    const avgGain = gains.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0) / period;
    const avgLoss = losses.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

function formatXAxisLabel(value: string, interval: ChartInterval) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (interval === "5m" || interval === "15m" || interval === "1h") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function getAllowedRanges(interval: ChartInterval): ReadonlyArray<(typeof RANGES)[number]> {
  if (interval === "5m" || interval === "15m") return ["1D"];
  if (interval === "1h") return ["1D", "5D", "1M", "3M"];
  return [...RANGES];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-[#0d0d0d] border border-border p-2 font-terminal text-[9px] space-y-0.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">O: {formatPrice(point.open)} H: {formatPrice(point.high)}</div>
      <div className="text-foreground">L: {formatPrice(point.low)} C: <span className="font-bold">{formatPrice(point.close)}</span></div>
      <div className="text-muted-foreground">VOL: {(point.volume / 1e6).toFixed(1)}M</div>
      {Object.entries(point)
        .filter(([key]) => key.startsWith("cmp_"))
        .map(([key, value]) => (
          <div key={key} className="text-muted-foreground">{key.replace("cmp_", "")}: {typeof value === "number" ? value.toFixed(2) : "—"}</div>
        ))}
    </div>
  );
};

export default function ChartPanel({ symbol, onSymbol }: Props) {
  const symbolIsCryptoCandidate = symbol.toUpperCase().endsWith("-USD");
  const [range, setRange] = useState<typeof RANGES[number]>(symbolIsCryptoCandidate ? "1D" : "1Y");
  const [interval, setInterval] = useState<ChartInterval>(symbolIsCryptoCandidate ? "5m" : "1d");
  const [indicator, setIndicator] = useState<(typeof INDICATORS)[number]>("SMA20");
  const [symInput, setSymInput] = useState(symbol);
  const [compareInput, setCompareInput] = useState("");
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const { data: quote } = useQuote(symbol);
  const isCrypto = quote?.exchange === "CRYPTO" || symbolIsCryptoCandidate;
  const supportsIntraday = supportsIntradayCharts(quote?.status.freshness ?? null, isCrypto);
  const allowedIntervals = getAllowedIntervals(supportsIntraday);
  const effectiveInterval = supportsIntraday ? interval : "1d";
  const effectiveRange = !supportsIntraday && range === "1D" ? "1M" : range;

  useEffect(() => {
    setSymInput(symbol);
    setCompareSymbols((current) => current.filter((entry) => entry !== symbol));
  }, [symbol]);

  useEffect(() => {
    if (!allowedIntervals.includes(interval)) {
      setInterval(allowedIntervals[0]);
    }
  }, [allowedIntervals, interval]);

  useEffect(() => {
    const allowedRanges = getAllowedRanges(effectiveInterval);
    if (!allowedRanges.includes(effectiveRange)) {
      setRange(allowedRanges[allowedRanges.length - 1]);
    }
  }, [effectiveInterval, effectiveRange]);

  const { data: series, isLoading } = useOHLCV(symbol, effectiveRange, effectiveInterval);
  const raw = series?.bars ?? [];

  const comparisonQueries = useQueries({
    queries: compareSymbols.map((entry) => ({
      queryKey: ["/api/finance/ohlcv", entry, effectiveRange, effectiveInterval],
      queryFn: async () => {
        const params = new URLSearchParams({ symbol: entry, range: effectiveRange, interval: effectiveInterval });
        const res = await fetch(`/api/finance/ohlcv?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch comparison OHLCV");
        const payload = await res.json() as { bars: Array<{ date: string; close: number }> };
        return payload.bars;
      },
      staleTime: 60_000,
      enabled: Boolean(entry),
    })),
  });

  const chartData = useMemo(() => {
    if (!raw.length) return [];
    const sma20 = computeSMA(raw, 20);
    const sma50 = computeSMA(raw, 50);
    const rsi = computeRSI(raw, 14);
    return raw.map((point, index) => ({
      ...point,
      sma20: sma20[index],
      sma50: sma50[index],
      rsi: rsi[index],
      xLabel: formatXAxisLabel(point.date, interval),
    }));
  }, [interval, raw]);

  const comparisonOverlayData = useMemo(() => {
    if (!chartData.length) return [];
    const comparisonSeries = comparisonQueries
      .map((query, index) => ({ symbol: compareSymbols[index], points: query.data ?? [] }))
      .filter((entry) => entry.symbol && entry.points.length > 0);

    if (!comparisonSeries.length) return chartData;

    const normalized = normalizeComparisonSeries([
      { symbol, points: chartData.map((point) => ({ date: point.date, close: point.close })) },
      ...comparisonSeries,
    ]);
    const normalizedMap = new Map(normalized.map((row) => [String(row.date), row]));

    return chartData.map((point) => ({
      ...point,
      ...(normalizedMap.get(point.date) ?? {}),
      [`cmp_${symbol}`]: normalizedMap.get(point.date)?.[symbol],
      ...Object.fromEntries(compareSymbols.map((entry) => [`cmp_${entry}`, normalizedMap.get(point.date)?.[entry]])),
    }));
  }, [chartData, compareSymbols, comparisonQueries, symbol]);

  const comparisonBounds = useMemo(() => {
    const values = comparisonOverlayData.flatMap((point) =>
      [symbol, ...compareSymbols]
        .map((entry) => point[`cmp_${entry}` as keyof typeof point])
        .filter((value): value is number => typeof value === "number"),
    );

    if (!values.length) return { min: 80, max: 120 };
    return {
      min: Math.floor(Math.min(...values) - 2),
      max: Math.ceil(Math.max(...values) + 2),
    };
  }, [comparisonOverlayData, compareSymbols, symbol]);

  const handleSymbolSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (symInput.trim()) onSymbol(symInput.trim().toUpperCase());
  };

  const handleAddComparison = (event: React.FormEvent) => {
    event.preventDefault();
    const next = compareInput.trim().toUpperCase();
    if (!next || next === symbol || compareSymbols.includes(next) || compareSymbols.length >= 2) return;
    setCompareSymbols((current) => [...current, next]);
    setCompareInput("");
  };

  const priceMin = chartData.length ? Math.min(...chartData.map((point) => point.low)) * 0.995 : 0;
  const priceMax = chartData.length ? Math.max(...chartData.map((point) => point.high)) * 1.005 : 0;
  const showRSI = indicator === "RSI";
  const allowedRanges = getAllowedRanges(effectiveInterval);
  const showIntradayNotice = !supportsIntraday;
  const seriesStatus = series?.status ?? quote?.status ?? null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050505]">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-[#070707] shrink-0 flex-wrap">
        <form onSubmit={handleSymbolSubmit} className="flex items-center gap-2">
          <input
            value={symInput}
            onChange={(event) => setSymInput(event.target.value.toUpperCase())}
            className="bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-xs text-[hsl(38,95%,55%)] focus:outline-none focus:border-[hsl(38,95%,50%)/60%] w-20"
            data-testid="chart-symbol-input"
          />
          <button type="submit" className="font-terminal text-[9px] text-muted-foreground border border-border px-2 py-1 hover:border-[hsl(38,95%,50%)/50%] hover:text-[hsl(38,95%,55%)]">GO</button>
        </form>

        {quote && (
          <div className="flex items-center gap-3">
            <span className="font-terminal text-sm font-bold tabular-nums">{formatPrice(quote.price)}</span>
            <span className={`font-terminal text-xs tabular-nums ${pctClass(quote.changePercent)}`}>
              {quote.changePercent >= 0 ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2)}%
            </span>
          </div>
        )}

        {seriesStatus && <DataStatusBadge status={seriesStatus} compact showAsOf />}

        <div className="flex items-center gap-px ml-2">
          {RANGES.map((entry) => {
            const enabled = allowedRanges.includes(entry);
            return (
              <button
                key={entry}
                onClick={() => enabled && setRange(entry)}
                disabled={!enabled}
                className={`px-2 py-1 font-terminal text-[9px] transition-colors ${
                  effectiveRange === entry ? "bg-[hsl(38,95%,50%)/20%] text-[hsl(38,95%,55%)]" : "text-muted-foreground hover:text-foreground"
                } ${!enabled ? "opacity-25 cursor-not-allowed" : ""}`}
              >
                {entry}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-px ml-2">
          {allowedIntervals.map((entry) => (
            <button
              key={entry}
              onClick={() => setInterval(entry)}
              className={`px-2 py-1 font-terminal text-[9px] transition-colors uppercase ${
                interval === entry ? "bg-[hsl(186,80%,50%)/20%] text-[hsl(186,80%,55%)]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-px ml-2">
          {INDICATORS.map((entry) => (
            <button
              key={entry}
              onClick={() => setIndicator(entry)}
              className={`px-2 py-1 font-terminal text-[9px] transition-colors ${
                indicator === entry ? "bg-[hsl(265,70%,55%)/20%] text-[hsl(265,70%,70%)]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry === "none" ? "NONE" : entry}
            </button>
          ))}
        </div>

        <form onSubmit={handleAddComparison} className="flex items-center gap-2 ml-auto">
          <input
            value={compareInput}
            onChange={(event) => setCompareInput(event.target.value.toUpperCase())}
            placeholder="COMPARE"
            className="bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-[10px] text-[hsl(186,80%,55%)] focus:outline-none focus:border-[hsl(186,80%,55%)/50%] w-24 uppercase"
            data-testid="chart-compare-input"
          />
          <button type="submit" className="flex items-center gap-1 px-2 py-1 font-terminal text-[9px] border border-border text-muted-foreground hover:text-foreground">
            <Plus className="w-3 h-3" /> COMPARE
          </button>
        </form>
      </div>

      <div className="px-4 py-2 border-b border-border bg-[#060606] flex items-center gap-2 flex-wrap shrink-0">
        <span className="font-terminal text-[8px] tracking-widest text-muted-foreground">OVERLAYS</span>
        {[symbol, ...compareSymbols].map((entry, index) => (
          <span key={entry} className="flex items-center gap-1.5 px-2 py-1 border border-border font-terminal text-[9px]" style={{ color: COMPARISON_COLORS[index] ?? "hsl(38,95%,55%)" }}>
            {entry}
            {entry !== symbol && (
              <button onClick={() => setCompareSymbols((current) => current.filter((value) => value !== entry))}>
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {showIntradayNotice && seriesStatus && (
          <span className="font-terminal text-[8px] tracking-widest text-muted-foreground ml-auto">
            {seriesStatus.delayLabel.toUpperCase()}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 p-6"><Skeleton className="w-full h-full bg-border" /></div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-px">
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comparisonOverlayData} margin={{ top: 4, right: 42, bottom: 4, left: 52 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,12%)" vertical={false} />
                <XAxis
                  dataKey="xLabel"
                  tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(comparisonOverlayData.length / 8))}
                />
                <YAxis
                  yAxisId="price"
                  domain={[priceMin, priceMax]}
                  tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatPrice(value)}
                  width={50}
                />
                <YAxis
                  yAxisId="comparison"
                  orientation="right"
                  domain={[comparisonBounds.min, comparisonBounds.max]}
                  tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  yAxisId="price"
                  dataKey="close"
                  fill="hsl(142,100%,63%)"
                  stroke="none"
                  maxBarSize={8}
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const isUp = payload.close >= payload.open;
                    return <rect x={x} y={y} width={width} height={height} fill={isUp ? "hsl(142,100%,55%)" : "hsl(0,100%,55%)"} stroke="none" />;
                  }}
                />
                {(indicator === "SMA20" || indicator === "SMA50") && (
                  <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="hsl(38,95%,55%)" strokeWidth={1.5} dot={false} connectNulls />
                )}
                {indicator === "SMA50" && (
                  <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="hsl(265,70%,65%)" strokeWidth={1.5} dot={false} connectNulls />
                )}
                {[symbol, ...compareSymbols].map((entry, index) => (
                  <Line
                    key={entry}
                    yAxisId="comparison"
                    type="monotone"
                    dataKey={`cmp_${entry}`}
                    stroke={COMPARISON_COLORS[index] ?? "hsl(38,95%,55%)"}
                    strokeWidth={index === 0 ? 2 : 1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {showRSI && (
            <div className="h-28 shrink-0">
              <div className="panel-label px-2 py-1 text-[hsl(186,80%,55%)]">RSI (14)</div>
              <ResponsiveContainer width="100%" height="80%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 52 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,12%)" vertical={false} />
                  <XAxis dataKey="xLabel" hide />
                  <YAxis domain={[0, 100]} tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }} tickLine={false} axisLine={false} ticks={[30, 50, 70]} width={50} />
                  <ReferenceLine y={70} stroke="hsl(0,100%,63%)" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="hsl(142,100%,63%)" strokeDasharray="3 3" strokeWidth={1} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const value = payload[0].value;
                    return <div className="bg-[#0d0d0d] border border-border p-1 font-terminal text-[9px]">RSI: {typeof value === "number" ? value.toFixed(1) : "—"}</div>;
                  }} />
                  <Line type="monotone" dataKey="rsi" stroke="hsl(186,80%,55%)" strokeWidth={1.5} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="h-20 shrink-0">
            <div className="panel-label px-2 py-1">VOLUME</div>
            <ResponsiveContainer width="100%" height="70%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 52 }}>
                <XAxis dataKey="xLabel" hide />
                <YAxis tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1e6).toFixed(0)}M`} width={50} />
                <Bar
                  dataKey="volume"
                  maxBarSize={8}
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const isUp = payload.close >= payload.open;
                    return <rect x={x} y={y} width={width} height={height} fill={isUp ? "hsl(142,100%,55%)" : "hsl(0,100%,55%)"} opacity={0.6} />;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
