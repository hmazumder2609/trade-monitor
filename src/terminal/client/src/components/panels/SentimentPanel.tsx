import { useSocialSentiment } from "@/lib/useFinance";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, TrendingUp, TrendingDown, ExternalLink, BarChart2 } from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  symbol?: string;
  onNav?: (v: ViewMode) => void;
  onSymbol?: (s: string) => void;
}

function SentimentBadge({ value }: { value: number }) {
  const abs = Math.abs(value);
  const isPositive = value >= 0;
  const intensity = abs < 0.2 ? "muted" : abs < 0.5 ? "moderate" : "strong";
  const colors = {
    positive: { strong: "text-up", moderate: "text-up/70", muted: "text-muted-foreground" },
    negative: { strong: "text-down", moderate: "text-down/70", muted: "text-muted-foreground" },
  };
  const c = isPositive ? colors.positive : colors.negative;
  return (
    <span className={`font-terminal text-[11px] tabular-nums ${c[intensity]}`}>
      {isPositive ? "+" : ""}{(value * 100).toFixed(0)}
    </span>
  );
}

export default function SentimentPanel({ symbol, onNav, onSymbol }: Props) {
  const { data, isLoading } = useSocialSentiment(symbol);
  const mentions = data?.mentions ?? [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-border" />
        <div className="grid grid-cols-2 gap-3">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-border" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-border bg-[#060606] px-5 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[hsl(38,95%,55%)]" />
          <span className="font-terminal text-xs font-bold tracking-wider text-foreground">
            SOCIAL SENTIMENT
          </span>
          {symbol && (
            <span className="font-terminal text-[10px] text-[hsl(38,95%,55%)] border border-[hsl(38,95%,55%)]/30 px-1.5 py-0.5">{symbol}</span>
          )}
          {data?.source && (
            <span className="font-terminal text-[8px] text-muted-foreground ml-auto">{data.source.toUpperCase()}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-border bg-[#060606]">
          <div className="text-center">
            <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">SYMBOLS</div>
            <div className="font-terminal text-lg font-bold tabular-nums text-foreground mt-0.5">{mentions.length}</div>
          </div>
          <div className="text-center">
            <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">TOTAL MENTIONS</div>
            <div className="font-terminal text-lg font-bold tabular-nums text-foreground mt-0.5">
              {mentions.reduce((a, m) => a + m.count, 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">BULLISH</div>
            <div className="font-terminal text-lg font-bold tabular-nums text-up mt-0.5">
              {mentions.reduce((a, m) => a + m.positiveCount, 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">BEARISH</div>
            <div className="font-terminal text-lg font-bold tabular-nums text-down mt-0.5">
              {mentions.reduce((a, m) => a + m.negativeCount, 0)}
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_60px_60px_60px_1fr] gap-2 px-5 py-2 border-b border-border bg-[#040404] font-terminal text-[8px] text-muted-foreground tracking-wider">
          <span>SYMBOL</span>
          <span className="text-right">MENTIONS</span>
          <span className="text-right">BULLISH</span>
          <span className="text-right">BEARISH</span>
          <span className="text-right">TOP POSTS</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/50">
          {mentions.map((m) => (
            <div key={m.symbol}>
              {/* Row header */}
              <div className="grid grid-cols-[1fr_60px_60px_60px_1fr] gap-2 px-5 py-2.5 hover:bg-white/[0.02] items-center">
                <div className="flex items-center gap-2 min-w-0">
                  {onSymbol ? (
                    <button onClick={() => onSymbol(m.symbol)} className="font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)] hover:underline truncate">
                      {m.symbol}
                    </button>
                  ) : (
                    <span className="font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)] truncate">{m.symbol}</span>
                  )}
                  <SentimentBadge value={m.sentiment} />
                </div>
                <span className="font-terminal text-[10px] tabular-nums text-right text-foreground">{m.count}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-up">{m.positiveCount}</span>
                <span className="font-terminal text-[10px] tabular-nums text-right text-down">{m.negativeCount}</span>
                <div className="flex justify-end gap-1">
                  {m.posts.slice(0, 3).map((post, i) => (
                    <a
                      key={i}
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      title={post.title}
                      className="w-6 h-6 flex items-center justify-center bg-border/30 hover:bg-border/60 transition-colors"
                    >
                      {post.thumbnail ? (
                        <img src={post.thumbnail} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      )}
                    </a>
                  ))}
                </div>
              </div>
              {/* Sentiment bar */}
              <div className="px-5 pb-2">
                <div className="relative h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 h-full rounded-full bg-up"
                    style={{ width: `${Math.max(5, (m.positiveCount / Math.max(1, m.positiveCount + m.negativeCount)) * 100)}%` }}
                  />
                  <div
                    className="absolute top-0 right-0 h-full rounded-full bg-down"
                    style={{ width: `${Math.max(5, (m.negativeCount / Math.max(1, m.positiveCount + m.negativeCount)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {mentions.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <BarChart2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-terminal text-xs text-muted-foreground">No sentiment data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
