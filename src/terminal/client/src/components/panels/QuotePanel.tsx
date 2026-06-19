import { useQuote, usePeers, useOHLCV, useNews } from "@/lib/useFinance";
import { formatPrice, formatPct, formatBig, pctClass } from "@/lib/finance";
import DataStatusBadge from "@/components/data/DataStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart as LCIcon, BarChart2, TrendingUp, TrendingDown } from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

interface Props {
  symbol: string;
  onNav: (v: ViewMode) => void;
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
      <span className="font-terminal text-[9px] text-muted-foreground tracking-wider">{label}</span>
      <span className={`font-terminal text-[11px] tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

// Static analyst ratings — generated deterministically from symbol
function getAnalystData(symbol: string) {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const buy = 10 + (seed % 20);
  const hold = 5 + (seed % 10);
  const sell = 1 + (seed % 5);
  const total = buy + hold + sell;
  const targetPremium = 0.08 + (seed % 20) / 100;
  return { buy, hold, sell, total, targetPremium };
}

const COMPANY_DESC: Record<string, string> = {
  "AAPL": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories. The company also sells various related services including AppleCare+, iCloud, Apple Music, Apple TV+, and the App Store.",
  "MSFT": "Microsoft Corp. develops and supports software, services, devices, and solutions. Segments include Productivity and Business Processes, Intelligent Cloud (Azure), and More Personal Computing.",
  "NVDA": "NVIDIA Corp. is the world's leading AI accelerator chipmaker. Its GPU, networking, and software stack power a large share of global AI training infrastructure.",
  "TSLA": "Tesla Inc. designs, develops, manufactures, leases, and sells electric vehicles, energy generation, and energy storage systems. Also develops advanced driver-assistance and full self-driving capabilities.",
  "GOOGL": "Alphabet Inc. is a holding company for Google and its subsidiaries. Offers advertising solutions, cloud computing (GCP), search, maps, YouTube, hardware devices, and various other technology services.",
  "AMZN": "Amazon.com Inc. engages in retail, cloud computing (AWS), digital streaming, and AI. AWS is the world's leading cloud platform, while retail encompasses marketplace, Prime, and logistics.",
  "META": "Meta Platforms Inc. develops products enabling people to connect, find communities, and grow businesses. Family of apps includes Facebook, Instagram, WhatsApp, and Messenger. Also investing heavily in AR/VR (Reality Labs).",
  "JPM": "JPMorgan Chase & Co. provides financial services including investment banking, commercial banking, financial transaction processing, asset management, and private banking globally.",
};

const DEFAULT_DESC = "A publicly traded company listed on major U.S. exchanges. Operates across multiple business segments generating revenue from products, services, and subscriptions in its respective market sector.";

export default function QuotePanel({ symbol, onNav }: Props) {
  const { data: q, isLoading } = useQuote(symbol);
  const { data: peers } = usePeers(symbol);
  const { data: ohlcvSeries } = useOHLCV(symbol, "1M"); // 1-month overview chart
  const { data: news } = useNews(symbol);
  const analyst = getAnalystData(symbol);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64 bg-border" />
        <Skeleton className="h-8 w-48 bg-border" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {Array(9).fill(0).map((_, i) => <Skeleton key={i} className="h-32 bg-border" />)}
        </div>
      </div>
    );
  }

  if (!q) return <div className="p-6 font-terminal text-muted-foreground text-sm">No data for {symbol}</div>;

  const range52Pct = q.high52 === q.low52 ? 50 : ((q.price - q.low52) / (q.high52 - q.low52)) * 100;
  const dayRangePct = q.dayHigh === q.dayLow ? 50 : ((q.price - q.dayLow) / (q.dayHigh - q.dayLow)) * 100;
  const priceTarget = parseFloat((q.price * (1 + analyst.targetPremium)).toFixed(2));
  const upside = q.price === 0 ? "0.0" : ((priceTarget - q.price) / q.price * 100).toFixed(1);

  // Build chart data from OHLCV (close prices)
  const chartData = (ohlcvSeries?.bars ?? []).map((bar) => ({
    date: bar.date.slice(5), // MM-DD
    close: bar.close,
  }));
  const isChartUp = chartData.length > 1 && chartData[chartData.length - 1].close >= chartData[0].close;

  const desc = COMPANY_DESC[symbol] || DEFAULT_DESC;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="border-b border-border bg-[#060606] px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-terminal text-2xl font-bold text-[hsl(38,95%,55%)]">{q.symbol}</span>
              {q.exchange && (
                <span className="font-terminal text-[9px] text-muted-foreground border border-border px-1.5 py-0.5">{q.exchange}</span>
              )}
              {q.sector && (
                <span className="font-terminal text-[9px] text-[hsl(186,80%,55%)] border border-[hsl(186,80%,55%)]/30 px-1.5 py-0.5">{q.sector}</span>
              )}
              <DataStatusBadge status={q.status} showAsOf />
            </div>
            <div className="font-terminal text-xs text-muted-foreground mt-0.5">{q.name}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onNav("chart")} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-amber-500/60 hover:text-amber-400 font-terminal text-[10px] text-muted-foreground transition-colors">
              <LCIcon className="w-3 h-3" /> CHART
            </button>
            <button onClick={() => onNav("news")} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-amber-500/60 hover:text-amber-400 font-terminal text-[10px] text-muted-foreground transition-colors">
              <BarChart2 className="w-3 h-3" /> NEWS
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-4 mt-4">
          <span className="font-terminal text-4xl font-bold tabular-nums text-foreground">${formatPrice(q.price)}</span>
          <span className={`font-terminal text-xl font-semibold tabular-nums ${pctClass(q.change)}`}>
            {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}
          </span>
          <span className={`font-terminal text-xl font-semibold tabular-nums ${pctClass(q.changePercent)}`}>
            ({q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%)
          </span>
        </div>

        {/* Day range bar */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between font-terminal text-[9px] text-muted-foreground">
            <span>DAY LO {formatPrice(q.dayLow)}</span>
            <span>DAY HI {formatPrice(q.dayHigh)}</span>
          </div>
          <div className="relative h-1.5 bg-border rounded-full overflow-hidden">
            <div className="absolute h-full w-1.5 bg-[hsl(38,95%,55%)] rounded-full -translate-x-1/2 z-10" style={{ left: `${Math.max(2, Math.min(98, dayRangePct))}%` }} />
            <div className="h-full bg-amber-500/20 rounded-full" style={{ width: `${dayRangePct}%` }} />
          </div>
        </div>
      </div>

      {/* Main 3-col grid */}
      <div className="grid grid-cols-3 gap-px bg-border">
        {/* Key Stats */}
        <div className="bg-[#060606] p-4">
          <div className="panel-label mb-3">KEY STATISTICS</div>
          <Stat label="MARKET CAP" value={formatBig(q.marketCap)} />
          <Stat label="P/E RATIO" value={q.pe !== null ? q.pe.toFixed(1) : "N/A"} />
          <Stat label="EPS (TTM)" value={q.eps !== null ? `$${q.eps.toFixed(2)}` : "N/A"} />
          <Stat label="VOLUME" value={q.volume.toLocaleString()} />
          <Stat label="AVG VOLUME" value={q.avgVolume.toLocaleString()} />
          <Stat label="OPEN" value={`$${formatPrice(q.open)}`} />
          <Stat label="PREV CLOSE" value={`$${formatPrice(q.previousClose)}`} />
          <Stat label="EXCHANGE" value={q.exchange} />
        </div>

        {/* 52-week range */}
        <div className="bg-[#060606] p-4">
          <div className="panel-label mb-3">52-WEEK RANGE</div>
          <div className="flex justify-between font-terminal text-[9px] text-muted-foreground mb-1">
            <span>LOW ${formatPrice(q.low52)}</span>
            <span>HIGH ${formatPrice(q.high52)}</span>
          </div>
          <div className="relative h-2 bg-border rounded-full overflow-hidden mb-4">
            <div className="absolute h-full w-2 bg-[hsl(38,95%,55%)] rounded-full -translate-x-1/2 z-10" style={{ left: `${Math.max(1, Math.min(99, range52Pct))}%` }} />
            <div className="h-full bg-gradient-to-r from-red-900/30 via-amber-900/20 to-green-900/30 rounded-full w-full" />
          </div>

          <div className="space-y-1 mt-2">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-terminal text-[9px] text-muted-foreground">CURRENT</span>
              <span className="font-terminal text-[11px] tabular-nums">${formatPrice(q.price)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-terminal text-[9px] text-muted-foreground">FROM HIGH</span>
              <span className="font-terminal text-[11px] tabular-nums text-down">
                -{q.high52 === 0 ? "0.0" : ((q.high52 - q.price) / q.high52 * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-terminal text-[9px] text-muted-foreground">FROM LOW</span>
              <span className="font-terminal text-[11px] tabular-nums text-up">
                +{q.low52 === 0 ? "0.0" : ((q.price - q.low52) / q.low52 * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Analyst consensus */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="panel-label mb-2">ANALYST CONSENSUS</div>
            <div className="flex gap-1 mb-2">
              <div className="h-2 rounded-full bg-[hsl(142,100%,63%)]" style={{ flex: analyst.buy }} />
              <div className="h-2 rounded-full bg-[hsl(38,95%,50%)]" style={{ flex: analyst.hold }} />
              <div className="h-2 rounded-full bg-[hsl(0,100%,63%)]" style={{ flex: analyst.sell }} />
            </div>
            <div className="flex justify-between font-terminal text-[8px]">
              <span className="text-up">BUY {analyst.buy}</span>
              <span className="text-[hsl(38,95%,55%)]">HOLD {analyst.hold}</span>
              <span className="text-down">SELL {analyst.sell}</span>
            </div>
            <div className="mt-2 flex items-center justify-between py-1 border-b border-border/50">
              <span className="font-terminal text-[9px] text-muted-foreground">12M TARGET</span>
              <span className="font-terminal text-[11px] tabular-nums text-up">${formatPrice(priceTarget)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="font-terminal text-[9px] text-muted-foreground">UPSIDE</span>
              <span className="font-terminal text-[11px] tabular-nums text-up">+{upside}%</span>
            </div>
          </div>
        </div>

        {/* Peers */}
        <div className="bg-[#060606] p-4">
          <div className="panel-label mb-3">PEER COMPARISON</div>
          <div className="space-y-0">
            <div className="grid grid-cols-3 py-1 border-b border-border font-terminal text-[8px] text-muted-foreground">
              <span>TICKER</span><span className="text-right">PRICE</span><span className="text-right">CHG%</span>
            </div>
            {/* Self */}
            <div className="grid grid-cols-3 py-1.5 border-b border-border/50 bg-amber-500/8">
              <span className="font-terminal text-[10px] font-bold text-[hsl(38,95%,55%)]">{q.symbol}</span>
              <span className="font-terminal text-[10px] tabular-nums text-right">{formatPrice(q.price)}</span>
              <span className={`font-terminal text-[10px] tabular-nums text-right ${pctClass(q.changePercent)}`}>{formatPct(q.changePercent)}</span>
            </div>
            {(peers || []).slice(0, 6).map((p: any) => (
              <div key={p.symbol} className="grid grid-cols-3 py-1.5 border-b border-border/50 hover:bg-white/5 cursor-pointer">
                <span className="font-terminal text-[10px] text-[hsl(186,80%,55%)]">{p.symbol}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right">{formatPrice(p.price)}</span>
                <span className={`font-terminal text-[10px] tabular-nums text-right ${pctClass(p.changePercent)}`}>{formatPct(p.changePercent)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second row: Price chart + Company info */}
      <div className="grid grid-cols-3 gap-px bg-border">
        {/* 1-Month Price Chart */}
        <div className="col-span-2 bg-[#060606] p-4">
          <div className="panel-label mb-3">30-DAY PRICE HISTORY</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id={`fill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isChartUp ? "hsl(142,100%,63%)" : "hsl(0,100%,63%)"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isChartUp ? "hsl(142,100%,63%)" : "hsl(0,100%,63%)"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontFamily: "JetBrains Mono", fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false} axisLine={false} domain={["auto","auto"]}
                  tickFormatter={(v) => `$${v.toFixed(0)}`} width={45} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid hsl(var(--border))", borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 10 }}
                  formatter={(v: any) => [`$${v.toFixed(2)}`, "Price"]}
                  labelStyle={{ color: "hsl(38,95%,55%)" }}
                />
                <Area type="monotone" dataKey="close"
                  stroke={isChartUp ? "hsl(142,100%,63%)" : "hsl(0,100%,63%)"}
                  strokeWidth={1.5} fill={`url(#fill-${symbol})`} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-36 w-full bg-border" />
          )}
        </div>

        {/* Company description + recent news */}
        <div className="bg-[#060606] p-4">
          <div className="panel-label mb-3">ABOUT {q.symbol}</div>
          <p className="font-terminal text-[9px] text-muted-foreground leading-relaxed line-clamp-5">{desc}</p>

          <div className="mt-4 pt-3 border-t border-border">
            <div className="panel-label mb-2">RECENT NEWS</div>
            {(news || []).slice(0, 3).map((n: any, i) => (
              <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block py-1.5 border-b border-border/50 hover:bg-white/5">
                <p className="font-terminal text-[9px] text-foreground leading-snug line-clamp-2">{n.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-terminal text-[8px] text-amber-500">{n.source}</span>
                  <span className={`font-terminal text-[8px] ${n.sentiment === "positive" ? "text-up" : n.sentiment === "negative" ? "text-down" : "text-muted-foreground"}`}>
                    {n.sentiment === "positive" ? "▲" : n.sentiment === "negative" ? "▼" : "●"}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
