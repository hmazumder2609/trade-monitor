import { useMemo, useState } from "react";
import { Briefcase, Plus, Trash2, Zap, LayoutList, RefreshCw, ExternalLink } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { usePortfolioAnalytics, useQuotes, useSnapTradePortfolio } from "@/lib/useFinance";
import { formatPct, formatPrice, pctClass, type PortfolioPositionInput } from "@/lib/finance";
import { Skeleton } from "@/components/ui/skeleton";

interface Position extends PortfolioPositionInput {
  id: number;
}

interface Props {
  onSymbol: (sym: string) => void;
}

const DEFAULT_POSITIONS: Position[] = [
  { id: 1, symbol: "AAPL", shares: 50, avgCost: 185.2 },
  { id: 2, symbol: "MSFT", shares: 25, avgCost: 380.4 },
  { id: 3, symbol: "NVDA", shares: 20, avgCost: 620 },
  { id: 4, symbol: "TSLA", shares: 30, avgCost: 220.5 },
  { id: 5, symbol: "META", shares: 15, avgCost: 480 },
  { id: 6, symbol: "GOOGL", shares: 10, avgCost: 165 },
  { id: 7, symbol: "JPM", shares: 40, avgCost: 215 },
  { id: 8, symbol: "XOM", shares: 35, avgCost: 105 },
];

const ALLOCATION_COLORS = [
  "hsl(38,95%,55%)",
  "hsl(186,80%,55%)",
  "hsl(142,100%,63%)",
  "hsl(265,70%,65%)",
  "hsl(0,100%,63%)",
  "hsl(200,80%,55%)",
  "hsl(60,90%,55%)",
  "hsl(300,70%,60%)",
];

function formatMetric(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 && suffix === "%" ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

type PortfolioSource = "manual" | "snaptrade";

export default function PortfolioPanel({ onSymbol }: Props) {
  const [source, setSource] = useState<PortfolioSource>("manual");
  const [positions, setPositions] = useState<Position[]>(DEFAULT_POSITIONS);
  const [addSym, setAddSym] = useState("");
  const [addShares, setAddShares] = useState("");
  const [addCost, setAddCost] = useState("");
  const [nextId, setNextId] = useState(DEFAULT_POSITIONS.length + 1);

  const { data: snapData, isLoading: snapLoading, refetch: snapRefetch } = useSnapTradePortfolio();

  // Derive active positions based on source
  const activePositions: Position[] = useMemo(() => {
    if (source === "snaptrade" && snapData?.configured && snapData.positions.length > 0) {
      return snapData.positions.map((p, i) => ({
        id: i + 1,
        symbol: p.symbol,
        shares: p.shares,
        avgCost: p.avgCost,
      }));
    }
    return positions;
  }, [source, snapData, positions]);

  const analyticsPositions = useMemo<PortfolioPositionInput[]>(() => {
    return activePositions.map(({ symbol, shares, avgCost }) => ({ symbol, shares, avgCost }));
  }, [activePositions]);

  const { data: quotes = [] } = useQuotes(activePositions.map((position) => position.symbol));
  const { data: analytics, isLoading: analyticsLoading } = usePortfolioAnalytics(analyticsPositions);
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

  const positionsWithValue = activePositions.map((position) => {
    const quote = quoteMap.get(position.symbol);
    const currentPrice = quote?.price ?? position.avgCost;
    const value = currentPrice * position.shares;
    const cost = position.avgCost * position.shares;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { ...position, currentPrice, value, cost, pnl, pnlPct, quote };
  });

  const totalValue = positionsWithValue.reduce((sum, position) => sum + position.value, 0);
  const totalCost = positionsWithValue.reduce((sum, position) => sum + position.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const allocation = positionsWithValue.map((position) => ({ name: position.symbol, value: position.value }));

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!addSym.trim() || !addShares || !addCost) return;

    setPositions((current) => [
      ...current,
      {
        id: nextId,
        symbol: addSym.trim().toUpperCase(),
        shares: Number(addShares),
        avgCost: Number(addCost),
      },
    ]);
    setNextId((value) => value + 1);
    setAddSym("");
    setAddShares("");
    setAddCost("");
  };

  const handleRemove = (id: number) => {
    setPositions((current) => current.filter((position) => position.id !== id));
  };

  const summaryCards = [
    { label: "TOTAL VALUE", value: `$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, cls: "" },
    { label: "TOTAL P&L", value: `${totalPnl >= 0 ? "+" : "-"}$${Math.abs(totalPnl).toFixed(0)}`, cls: pctClass(totalPnl) },
    { label: "RETURN %", value: formatPct(totalPnlPct), cls: pctClass(totalPnlPct) },
  ];

  const riskCards = [
    { label: `${analytics?.benchmarkSymbol ?? "SPY"} RETURN`, value: formatMetric(analytics?.benchmarkReturnPct, "%"), cls: pctClass(analytics?.benchmarkReturnPct ?? 0) },
    { label: "ACTIVE RETURN", value: formatMetric(analytics?.activeReturnPct, "%"), cls: pctClass(analytics?.activeReturnPct ?? 0) },
    { label: "BETA", value: formatMetric(analytics?.beta), cls: "" },
    { label: "VOLATILITY", value: formatMetric(analytics?.annualizedVolatilityPct, "%"), cls: "" },
    { label: "MAX DRAWDOWN", value: formatMetric(analytics?.maxDrawdownPct, "%"), cls: pctClass(analytics?.maxDrawdownPct ?? 0) },
  ];

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-[#050505]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#070707] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[hsl(38,95%,55%)]" />
          <span className="panel-label">PORTFOLIO</span>
          {/* Source toggle */}
          <div className="flex items-center border border-border ml-2">
            <button
              onClick={() => setSource("manual")}
              className={`flex items-center gap-1 px-2 py-0.5 font-terminal text-[8px] tracking-widest transition-colors ${
                source === "manual" ? "bg-[hsl(38,95%,50%)/20%] text-[hsl(38,95%,55%)]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="w-2.5 h-2.5" /> MANUAL
            </button>
            <button
              onClick={() => setSource("snaptrade")}
              className={`flex items-center gap-1 px-2 py-0.5 font-terminal text-[8px] tracking-widest transition-colors border-l border-border ${
                source === "snaptrade" ? "bg-[hsl(142,100%,63%)/15%] text-[hsl(142,100%,63%)]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-2.5 h-2.5" /> LIVE
            </button>
          </div>
          {source === "snaptrade" && snapData?.configured && (
            <button onClick={() => snapRefetch()} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh SnapTrade data">
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="text-right">
          <div className="font-terminal text-lg font-bold tabular-nums">${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
          <div className={`font-terminal text-[10px] tabular-nums ${pctClass(totalPnlPct)}`}>
            {totalPnl >= 0 ? "+" : "-"}${Math.abs(totalPnl).toFixed(0)} ({formatPct(totalPnlPct)})
          </div>
        </div>
      </div>

      {/* SnapTrade status banners */}
      {source === "snaptrade" && snapLoading && (
        <div className="px-4 py-2 border-b border-border bg-[#070707] font-terminal text-[9px] text-muted-foreground">
          LOADING SNAPTRADE POSITIONS…
        </div>
      )}
      {source === "snaptrade" && !snapLoading && snapData && !snapData.configured && (
        <div className="px-4 py-3 border-b border-border bg-[#070707] flex items-center justify-between">
          <span className="font-terminal text-[9px] text-muted-foreground">
            SNAPTRADE NOT CONFIGURED — add credentials in Dashboard Settings
          </span>
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 font-terminal text-[9px] text-[hsl(38,95%,55%)] hover:underline"
          >
            OPEN DASHBOARD <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
      {source === "snaptrade" && !snapLoading && snapData?.configured && snapData.error && (
        <div className="px-4 py-2 border-b border-border bg-[#070707] font-terminal text-[9px] text-[hsl(0,100%,68%)]">
          SNAPTRADE ERROR: {snapData.error}
        </div>
      )}
      {source === "snaptrade" && !snapLoading && snapData?.configured && !snapData.error && snapData.accounts.length > 0 && (
        <div className="px-4 py-1.5 border-b border-border bg-[#070707] flex items-center gap-3 overflow-x-auto scrollbar-thin">
          {snapData.accounts.map(a => (
            <span key={a.id} className="font-terminal text-[8px] text-muted-foreground shrink-0">
              <span className="text-[hsl(38,95%,55%)]">{a.name}</span> · {a.type} · {a.currency}
            </span>
          ))}
        </div>
      )}

      <div className="p-4 space-y-4">
        {source === "manual" && (
          <form onSubmit={handleAdd} className="flex items-center gap-2 p-3 border border-border bg-[#080808]">
            <span className="font-terminal text-[9px] text-muted-foreground shrink-0">ADD POSITION</span>
            <input value={addSym} onChange={(event) => setAddSym(event.target.value.toUpperCase())} placeholder="TICKER" className="w-20 bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-[10px] focus:outline-none" />
            <input type="number" value={addShares} onChange={(event) => setAddShares(event.target.value)} placeholder="SHARES" className="w-20 bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-[10px] focus:outline-none" />
            <input type="number" value={addCost} onChange={(event) => setAddCost(event.target.value)} placeholder="AVG COST" step="0.01" className="w-24 bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-[10px] focus:outline-none" />
            <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(38,95%,50%)/15%] border border-[hsl(38,95%,50%)/40%] font-terminal text-[10px] text-[hsl(38,95%,55%)] hover:bg-[hsl(38,95%,50%)/25%]">
              <Plus className="w-3 h-3" /> ADD
            </button>
          </form>
        )}

        <div className="grid grid-cols-3 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-[#080808] border border-border p-3">
              <div className="font-terminal text-[9px] text-muted-foreground tracking-widest mb-1">{card.label}</div>
              <div className={`font-terminal text-xl font-bold tabular-nums ${card.cls}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-3">
          {riskCards.map((card) => (
            <div key={card.label} className="bg-[#080808] border border-border p-3">
              <div className="font-terminal text-[8px] text-muted-foreground tracking-widest mb-1">{card.label}</div>
              <div className={`font-terminal text-base font-bold tabular-nums ${card.cls}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-[#080808] border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="panel-label">30D VS {analytics?.benchmarkSymbol ?? "SPY"}</div>
              <div className="font-terminal text-[8px] tracking-widest text-muted-foreground">INDEXED TO 100</div>
            </div>
            {analyticsLoading ? (
              <Skeleton className="w-full h-[140px] bg-border" />
            ) : analytics?.chart.length ? (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={analytics.chart} margin={{ top: 4, right: 4, bottom: 4, left: 48 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,12%)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fill: "hsl(0,0%,45%)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d0d0d", border: "1px solid hsl(0,0%,13%)", fontFamily: "monospace", fontSize: 9 }} />
                  <Line type="monotone" dataKey="portfolio" stroke="hsl(38,95%,55%)" strokeWidth={1.7} dot={false} name="Portfolio" />
                  <Line type="monotone" dataKey="benchmark" stroke="hsl(186,80%,55%)" strokeWidth={1.5} dot={false} name={analytics.benchmarkSymbol} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[140px] flex items-center justify-center font-terminal text-xs text-muted-foreground">INSUFFICIENT HISTORY FOR ANALYTICS</div>
            )}
          </div>

          <div className="bg-[#080808] border border-border p-3">
            <div className="panel-label mb-2">ALLOCATION</div>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={allocation} cx="50%" cy="50%" outerRadius={52} dataKey="value" nameKey="name" label={({ name }) => name} labelLine={false}>
                  {allocation.map((_, index) => <Cell key={index} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#080808] border border-border">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_1.5fr_1.5fr_1fr_auto] px-3 py-1.5 border-b border-border font-terminal text-[8px] text-muted-foreground">
            {['SYMBOL', 'SHARES', 'AVG COST', 'CURRENT', 'VALUE', 'P&L', 'RETURN', 'WEIGHT', ''].map((heading, index) => (
              <span key={heading + index} className={index > 0 ? 'text-right' : ''}>{heading}</span>
            ))}
          </div>
          {positionsWithValue.map((position) => {
            const weightPct = totalValue > 0 ? (position.value / totalValue) * 100 : 0;
            return (
              <div
                key={position.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_1.5fr_1.5fr_1fr_auto] px-3 py-2.5 border-b border-border/50 hover:bg-white/5 group items-center cursor-pointer"
                onClick={() => onSymbol(position.symbol)}
              >
                <span className="font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)]">{position.symbol}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right">{position.shares}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-muted-foreground">${formatPrice(position.avgCost)}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right">${formatPrice(position.currentPrice)}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right">${position.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                <span className={`font-terminal text-[10px] tabular-nums text-right font-semibold ${pctClass(position.pnl)}`}>
                  {position.pnl >= 0 ? '+' : '-'}${Math.abs(position.pnl).toFixed(0)}
                </span>
                <span className={`font-terminal text-[10px] tabular-nums text-right font-semibold ${pctClass(position.pnlPct)}`}>
                  {formatPct(position.pnlPct)}
                </span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-muted-foreground">{weightPct.toFixed(1)}%</span>
                {source === "manual" && (
                  <button onClick={(event) => { event.stopPropagation(); handleRemove(position.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[hsl(0,100%,68%)] transition-all p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
