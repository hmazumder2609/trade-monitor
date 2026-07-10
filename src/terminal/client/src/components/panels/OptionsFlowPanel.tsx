import { useOptionsFlow } from "@/lib/useFinance";
import { Skeleton } from "@/components/ui/skeleton";
import { CandlestickChart, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  symbol?: string;
  onSymbol?: (s: string) => void;
}

function StatBox({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="text-center">
      <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">{label}</div>
      <div className={`font-terminal text-lg font-bold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

function ratioClass(ratio: number): string {
  if (ratio < 0.4) return "text-up";
  if (ratio > 0.6) return "text-down";
  return "text-[hsl(38,95%,55%)]";
}

export default function OptionsFlowPanel({ symbol, onSymbol }: Props) {
  const { data, isLoading } = useOptionsFlow(symbol);
  const summary = data?.summary;
  const activity = data?.activity ?? [];
  const trades = data?.trades ?? [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-border" />
        <div className="grid grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-border" />)}
        </div>
        <Skeleton className="h-64 w-full bg-border" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-border bg-[#060606] px-5 py-3">
        <div className="flex items-center gap-2">
          <CandlestickChart className="w-4 h-4 text-[hsl(38,95%,55%)]" />
          <span className="font-terminal text-xs font-bold tracking-wider text-foreground">OPTIONS FLOW</span>
          {symbol && (
            <span className="font-terminal text-[10px] text-[hsl(38,95%,55%)] border border-[hsl(38,95%,55%)]/30 px-1.5 py-0.5">{symbol}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {summary && (
          <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-border bg-[#060606]">
            <StatBox label="PUT/CALL RATIO" value={summary.putCallRatio.toFixed(2)} cls={ratioClass(summary.putCallRatio)} />
            <StatBox label="TOTAL VOLUME" value={(summary.totalVolume / 1e6).toFixed(1) + "M"} />
            <StatBox label="CALL VOLUME" value={(summary.callVolume / 1e6).toFixed(1) + "M"} cls="text-up" />
            <StatBox label="PUT VOLUME" value={(summary.putVolume / 1e6).toFixed(1) + "M"} cls="text-down" />
          </div>
        )}

        {/* Unusual Activity */}
        <div className="border-b border-border">
          <div className="px-5 py-2 bg-[#040404] font-terminal text-[9px] tracking-wider text-muted-foreground border-b border-border">
            UNUSUAL OPTIONS ACTIVITY
          </div>
          <div className="grid grid-cols-[1fr_70px_90px_70px_70px_70px] gap-2 px-5 py-1.5 bg-[#040404] font-terminal text-[8px] text-muted-foreground tracking-wider border-b border-border/50">
            <span>SYMBOL</span>
            <span className="text-right">TYPE</span>
            <span className="text-right">STRIKE</span>
            <span className="text-right">VOLUME</span>
            <span className="text-right">O.I.</span>
            <span className="text-right">V/OI</span>
          </div>
          <div className="divide-y divide-border/50">
            {activity.slice(0, 15).map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_90px_70px_70px_70px] gap-2 px-5 py-2 hover:bg-white/[0.02] items-center">
                <div className="flex items-center gap-1.5 min-w-0">
                  {onSymbol ? (
                    <button onClick={() => onSymbol(item.symbol)} className="font-terminal text-[10px] font-bold text-[hsl(38,95%,55%)] hover:underline truncate">{item.symbol}</button>
                  ) : (
                    <span className="font-terminal text-[10px] font-bold text-[hsl(38,95%,55%)] truncate">{item.symbol}</span>
                  )}
                  {item.sentiment === 'bullish' ? (
                    <TrendingUp className="w-3 h-3 text-up" />
                  ) : item.sentiment === 'bearish' ? (
                    <TrendingDown className="w-3 h-3 text-down" />
                  ) : null}
                </div>
                <span className={`font-terminal text-[10px] tabular-nums text-right ${item.optionType === 'call' ? 'text-up' : 'text-down'}`}>
                  {item.optionType.toUpperCase()}
                </span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-foreground">${item.strike.toFixed(1)}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-foreground">{item.volume.toLocaleString()}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-muted-foreground">{item.openInterest.toLocaleString()}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-[hsl(38,95%,55%)]">{item.vOiRatio.toFixed(1)}x</span>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="px-5 py-8 text-center font-terminal text-xs text-muted-foreground">No unusual activity detected</div>
            )}
          </div>
        </div>

        {/* Block Trades */}
        <div>
          <div className="px-5 py-2 bg-[#040404] font-terminal text-[9px] tracking-wider text-muted-foreground border-b border-border">
            BLOCK TRADES
          </div>
          <div className="grid grid-cols-[1fr_60px_90px_70px_80px] gap-2 px-5 py-1.5 bg-[#040404] font-terminal text-[8px] text-muted-foreground tracking-wider border-b border-border/50">
            <span>SYMBOL</span>
            <span className="text-right">TYPE</span>
            <span className="text-right">STRIKE</span>
            <span className="text-right">SIZE</span>
            <span className="text-right">PREMIUM</span>
          </div>
          <div className="divide-y divide-border/50">
            {trades.slice(0, 10).map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_90px_70px_80px] gap-2 px-5 py-2 hover:bg-white/[0.02] items-center">
                <div className="flex items-center gap-1.5 min-w-0">
                  {onSymbol ? (
                    <button onClick={() => onSymbol(t.symbol)} className="font-terminal text-[10px] font-bold text-[hsl(38,95%,55%)] hover:underline truncate">{t.symbol}</button>
                  ) : (
                    <span className="font-terminal text-[10px] font-bold text-[hsl(38,95%,55%)] truncate">{t.symbol}</span>
                  )}
                  {t.sentiment === 'bullish' ? (
                    <TrendingUp className="w-3 h-3 text-up" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-down" />
                  )}
                </div>
                <span className={`font-terminal text-[10px] tabular-nums text-right ${t.optionType === 'call' ? 'text-up' : 'text-down'}`}>
                  {t.optionType.toUpperCase()}
                </span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-foreground">${t.strike.toFixed(0)}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-foreground">{t.size.toLocaleString()}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-[hsl(38,95%,55%)]">${(t.premium / 1000).toFixed(0)}K</span>
              </div>
            ))}
            {trades.length === 0 && (
              <div className="px-5 py-8 text-center font-terminal text-xs text-muted-foreground">No block trades recorded</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
