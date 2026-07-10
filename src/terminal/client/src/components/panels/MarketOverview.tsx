import { useState } from "react";
import { useQuotes, useMarketGainers, useMarketLosers, useMostActive, useMarketSentiment, useNews, useIndexSparklines } from "@/lib/useFinance";
import { formatPrice, formatBig, pctClass, INDICES } from "@/lib/finance";
import DataStatusBadge from "@/components/data/DataStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "@/lib/terminalTypes";
import { LineChart, Line, Area, ResponsiveContainer } from "recharts";

interface Props {
  onSymbol: (sym: string) => void;
  onNav: (v: ViewMode) => void;
}

function PanelHeader({ label, extra }: { label: string; extra?: string }) {
  return (
    <div className="panel-header">
      <span className="panel-label">{label}</span>
      {extra && <span className="font-terminal text-[9px] text-muted-foreground">{extra}</span>}
    </div>
  );
}

// Mini sparkline for index cards
function Sparkline({ data, isUp }: { data: number[]; isUp: boolean }) {
  const chartData = data.map((v, i) => ({ i, v }));
  const color = isUp ? "hsl(142,100%,63%)" : "hsl(0,100%,63%)";
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area type="monotone" dataKey="v" fill={color} fillOpacity={0.08} stroke="none" isAnimationActive={false} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function QuoteRow({ q, onClick }: { q: any; onClick: () => void }) {
  const isUp = q.changePercent >= 0;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 border-b border-border/50 text-left"
      data-testid={`quote-row-${q.symbol}`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)] truncate">{q.symbol}</div>
        <div className="font-terminal text-[9px] text-muted-foreground truncate">{q.name}</div>
      </div>
      <div className="text-right">
        <div className="font-terminal text-[11px] tabular-nums text-foreground">{formatPrice(q.price)}</div>
        <div className={`font-terminal text-[9px] tabular-nums ${pctClass(q.changePercent)}`}>
          {isUp ? "▲" : "▼"}{Math.abs(q.changePercent).toFixed(2)}%
        </div>
      </div>
    </button>
  );
}

export default function MarketOverview({ onSymbol, onNav }: Props) {
  const indexSymbols = INDICES.map(i => i.symbol);
  const { data: indices, isLoading: idxLoad } = useQuotes(indexSymbols);
  const { data: sparklines } = useIndexSparklines();
  const { data: gainers, isLoading: gLoad } = useMarketGainers();
  const { data: losers, isLoading: lLoad } = useMarketLosers();
  const { data: active, isLoading: aLoad } = useMostActive();
  const { data: sentiment } = useMarketSentiment();
  const { data: news } = useNews();

  const [tab, setTab] = useState<"gainers" | "losers" | "active">("gainers");
  const tabData = tab === "gainers" ? gainers : tab === "losers" ? losers : active;
  const tabLoad = tab === "gainers" ? gLoad : tab === "losers" ? lLoad : aLoad;


  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  // Market status
  const getMarketStatus = () => {
    const now = new Date();
    const h = now.getUTCHours() - 5; // ET offset (rough)
    const min = now.getUTCMinutes();
    const t = h * 60 + min;
    if (t >= 570 && t < 630) return { label: "PRE-MARKET", color: "text-[hsl(38,95%,55%)]" };
    if (t >= 630 && t < 960) return { label: "MARKET OPEN", color: "text-up" };
    if (t >= 960 && t < 1200) return { label: "AFTER-HOURS", color: "text-[hsl(38,95%,55%)]" };
    return { label: "MARKET CLOSED", color: "text-muted-foreground" };
  };
  const mktStatus = getMarketStatus();

  return (
    <div className="h-full flex flex-col gap-px bg-border overflow-hidden">
      {/* Indices bar — full width top */}
      <div className="bg-[#060606] flex flex-col shrink-0" style={{ height: "42%" }}>
        <div className="panel-header">
          <span className="panel-label">GLOBAL INDICES</span>
          <span className={`font-terminal text-[9px] font-semibold ${mktStatus.color}`}>{mktStatus.label}</span>
          <span className="font-terminal text-[9px] text-muted-foreground ml-auto">{new Date().toLocaleTimeString()}</span>
        </div>
        <div className="grid grid-cols-6 gap-px bg-border flex-1">
          {INDICES.map((idx, i) => {
            const q = indices?.[i];
            const sparkData = sparklines?.[idx.symbol];
            const isUp = (q?.changePercent ?? 0) >= 0;
            const isVix = idx.symbol === '^VIX';
            const isBtc = idx.symbol === 'BTC-USD';

            // VIX fear gauge helpers
            const vixColor = (p: number) =>
              p < 20 ? "hsl(142,100%,63%)" :
              p < 30 ? "hsl(38,95%,55%)" :
              "hsl(0,100%,63%)";
            const vixLabel = (p: number) =>
              p < 20 ? "LOW FEAR" :
              p < 30 ? "NORMAL" :
              p < 35 ? "ELEVATED" :
              "HIGH FEAR";
            const vixPrice = q?.price ?? 0;
            const vixGaugeColor = vixColor(vixPrice);
            const range52 = (q?.high52 ?? 80) - (q?.low52 ?? 10);
            const percentile = range52 > 0 ? ((vixPrice - (q?.low52 ?? 10)) / range52) * 100 : 50;

            // For VIX, up is red (fear)
            const vixIsUp = (q?.changePercent ?? 0) >= 0;
            const changeColor = isVix
              ? (vixIsUp ? "text-down" : "text-up")
              : pctClass(q?.changePercent ?? 0);
            const arrowClass = isVix
              ? (vixIsUp ? "text-down" : "text-up")
              : (isUp ? "text-up" : "text-down");

            return (
              <button
                key={idx.symbol}
                onClick={() => onSymbol(idx.symbol)}
                className={`bg-[#080808] hover:bg-white/5 flex flex-col justify-between p-3 transition-colors group ${isVix ? "relative overflow-hidden" : ""}`}
                data-testid={`index-${idx.symbol}`}
              >
                <div className="flex items-start justify-between w-full z-10 relative">
                  <div className={`font-terminal text-[9px] tracking-widest ${isBtc ? "text-[hsl(186,80%,55%)]" : "text-muted-foreground"}`}>
                    {isVix ? "VOLATILITY" : idx.label}
                  </div>
                  <div className={`font-terminal text-[8px] px-1 py-0.5 rounded ${arrowClass}`}>
                    {isVix ? (vixIsUp ? "▲" : "▼") : (isUp ? "▲" : "▼")}
                  </div>
                </div>

                {q ? (
                  <div className="flex flex-col gap-1 z-10 relative flex-1 justify-center">
                    {isVix ? (
                      <>
                        <div className="font-terminal text-lg font-bold tabular-nums" style={{ color: vixGaugeColor }}>
                          {q.price.toFixed(2)}
                        </div>
                        {/* Gauge bar */}
                        <div className="w-full h-1.5 bg-border/50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{
                            width: `${Math.min(100, Math.max(0, (vixPrice / 50) * 100))}%`,
                            background: vixGaugeColor
                          }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-terminal text-[9px] font-semibold tracking-wide" style={{ color: vixGaugeColor }}>
                            {vixLabel(vixPrice)}
                          </span>
                          <span className="font-terminal text-[7px] text-muted-foreground tabular-nums">
                            {percentile.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-terminal text-[9px] tabular-nums font-semibold ${changeColor}`}>
                            {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
                          </span>
                          <span className={`font-terminal text-[8px] tabular-nums ${changeColor}`}>
                            {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-terminal text-base font-bold text-foreground tabular-nums">
                          {formatPrice(q.price)}
                        </div>
                        {sparkData ? (
                          <div className="w-full opacity-70 group-hover:opacity-100 transition-opacity">
                            <Sparkline data={sparkData} isUp={isUp} />
                          </div>
                        ) : (
                          <div className="h-[48px] w-full" />
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className={`font-terminal text-[10px] tabular-nums font-semibold ${pctClass(q.changePercent)}`}>
                            {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
                          </span>
                          <span className={`font-terminal text-[9px] tabular-nums ${pctClass(q.change)}`}>
                            {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <Skeleton className="h-6 w-24 mt-1 bg-border" />
                    <Skeleton className="h-9 w-full bg-border" />
                    <Skeleton className="h-3 w-16 bg-border" />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex gap-px flex-1 overflow-hidden">
        {/* Movers panel */}
        <div className="w-64 bg-[#060606] flex flex-col overflow-hidden shrink-0">
          <div className="panel-header gap-0 p-0">
            {(["gainers", "losers", "active"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 font-terminal text-[9px] tracking-widest border-r border-border transition-colors ${
                  tab === t ? "bg-amber-500/10 text-[hsl(38,95%,55%)]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "gainers" ? "TOP GAIN" : t === "losers" ? "TOP LOSS" : "ACTIVE"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {tabLoad
              ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-9 mx-2 my-1 bg-border" />)
              : (tabData || []).slice(0, 10).map((q: any) => (
                  <QuoteRow key={q.symbol} q={q} onClick={() => onSymbol(q.symbol)} />
                ))
            }
          </div>
        </div>

        {/* Sentiment */}
        <div className="w-48 bg-[#060606] flex flex-col overflow-hidden shrink-0">
          <PanelHeader label="SENTIMENT" />
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-3">
            {sentiment ? (
              <>
                <div className={`font-terminal text-xl font-bold ${
                  sentiment.sentiment === "Bullish" ? "text-up" :
                  sentiment.sentiment === "Bearish" ? "text-down" :
                  "text-[hsl(38,95%,55%)]"
                }`}>
                  {sentiment.sentiment === "Bullish" ? "🐂" : sentiment.sentiment === "Bearish" ? "🐻" : "—"} {sentiment.sentiment.toUpperCase()}
                </div>
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-terminal text-[9px] text-up">BULL</span>
                    <span className="font-terminal text-[9px] text-up tabular-nums">{sentiment.bullish}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-[hsl(142,100%,63%)] rounded-full transition-all duration-500" style={{ width: `${sentiment.bullish}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-terminal text-[9px] text-down">BEAR</span>
                    <span className="font-terminal text-[9px] text-down tabular-nums">{sentiment.bearish}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-[hsl(0,100%,63%)] rounded-full transition-all duration-500" style={{ width: `${sentiment.bearish}%` }} />
                  </div>
                  <div className="pt-1 border-t border-border">
                    <div className="font-terminal text-[8px] text-muted-foreground text-center">
                      FEAR & GREED INDEX
                    </div>
                    <div className="font-terminal text-[11px] font-bold text-center tabular-nums mt-0.5" style={{
                      color: sentiment.score > 60 ? "hsl(142,100%,63%)" : sentiment.score < 40 ? "hsl(0,100%,63%)" : "hsl(38,95%,55%)"
                    }}>
                      {sentiment.score.toFixed(0)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Skeleton className="h-20 w-full bg-border" />
            )}
          </div>
        </div>

        {/* News */}
        <div className="flex-1 bg-[#060606] flex flex-col overflow-hidden">
          <PanelHeader label="MARKET HEADLINES" extra="LIVE" />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {(news || []).map((n: any, i: number) => {
              const sentColor = n.sentiment === "positive" ? "bg-[hsl(142,100%,40%)]" :
                               n.sentiment === "negative" ? "bg-[hsl(0,100%,50%)]" :
                               "bg-[hsl(38,95%,40%)]";
              return (
                <div key={i} className="px-3 py-2.5 border-b border-border/50 hover:bg-white/5 cursor-pointer">
                  <div className="flex items-start gap-2">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${sentColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-terminal text-[10px] text-foreground leading-snug line-clamp-2">{n.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-terminal text-[8px] px-1.5 py-0.5 border border-border text-[hsl(38,95%,55%)]">{n.source.toUpperCase()}</span>
                        <span className="font-terminal text-[8px] text-muted-foreground">{relativeTime(n.publishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
