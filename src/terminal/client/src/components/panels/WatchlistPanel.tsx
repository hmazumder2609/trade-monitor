import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuotes, useWatchlistBridge } from "@/lib/useFinance";
import { formatPrice, formatPct, formatBig, pctClass } from "@/lib/finance";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Star, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WatchlistItem } from "@shared/schema";

interface Props { onSymbol: (sym: string) => void }

export default function WatchlistPanel({ onSymbol }: Props) {
  const [addSym, setAddSym] = useState("");
  const [addName, setAddName] = useState("");
  const qc = useQueryClient();

  const { data: watchlist = [], isLoading: wLoad } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist");
      return res.json();
    },
  });

  const symbols = watchlist.map(w => w.symbol);
  const { data: quotes } = useQuotes(symbols);

  const addMut = useMutation({
    mutationFn: async ({ symbol, name }: { symbol: string; name: string }) => {
      await apiRequest("POST", "/api/watchlist", { symbol, name });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/watchlist"] }); setAddSym(""); setAddName(""); },
  });

  const removeMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });

  const { data: bridgeWatchlist } = useWatchlistBridge();

  // Sync from dashboard bridge — adds any missing symbols to the terminal watchlist
  const [syncing, setSyncing] = useState(false);
  const handleSyncFromDashboard = async () => {
    if (!bridgeWatchlist?.length || syncing) return;
    setSyncing(true);
    try {
      const existing = new Set(watchlist.map(w => w.symbol));
      const toAdd = bridgeWatchlist.filter(e => !existing.has(e.symbol));
      for (const entry of toAdd) {
        await apiRequest("POST", "/api/watchlist", { symbol: entry.symbol, name: entry.name ?? entry.symbol });
      }
      qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = addSym.trim().toUpperCase();
    if (!sym) return;
    addMut.mutate({ symbol: sym, name: addName.trim() || sym });
  };

  const quoteMap = new Map((quotes || []).map((q: any) => [q.symbol, q]));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050505]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-[#070707] shrink-0">
        <Star className="w-4 h-4 text-[hsl(38,95%,55%)]" />
        <span className="panel-label">WATCHLIST</span>
        <span className="font-terminal text-[9px] text-muted-foreground ml-2">{watchlist.length} SYMBOLS</span>
        <div className="ml-auto flex items-center gap-2">
          {bridgeWatchlist && bridgeWatchlist.some(e => !watchlist.find(w => w.symbol === e.symbol)) && (
            <button
              onClick={handleSyncFromDashboard}
              disabled={syncing}
              className="flex items-center gap-1 font-terminal text-[8px] tracking-widest text-muted-foreground hover:text-[hsl(38,95%,55%)] transition-colors disabled:opacity-40"
              title="Sync new symbols from Dashboard watchlist"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${syncing ? "animate-spin" : ""}`} />
              SYNC DASHBOARD ({bridgeWatchlist.filter(e => !watchlist.find(w => w.symbol === e.symbol)).length} NEW)
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 px-4 py-2 border-b border-border bg-[#070707] shrink-0">
        <span className="font-terminal text-[9px] text-muted-foreground shrink-0">ADD</span>
        <input
          value={addSym}
          onChange={e => setAddSym(e.target.value.toUpperCase())}
          placeholder="TICKER"
          className="w-20 bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-[10px] focus:outline-none focus:border-[hsl(38,95%,50%)/50%]"
          data-testid="watchlist-sym-input"
        />
        <input
          value={addName}
          onChange={e => setAddName(e.target.value)}
          placeholder="NAME (optional)"
          className="flex-1 bg-[#0d0d0d] border border-border px-2 py-1 font-terminal text-[10px] focus:outline-none focus:border-[hsl(38,95%,50%)/50%]"
        />
        <button
          type="submit"
          disabled={!addSym.trim() || addMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1 bg-[hsl(38,95%,50%)/15%] border border-[hsl(38,95%,50%)/40%] font-terminal text-[10px] text-[hsl(38,95%,55%)] hover:bg-[hsl(38,95%,50%)/25%] disabled:opacity-40 transition-colors"
          data-testid="watchlist-add-btn"
        >
          <Plus className="w-3 h-3" /> ADD
        </button>
      </form>

      {/* Table header */}
      <div className="grid grid-cols-[2fr_3fr_1.5fr_1.5fr_2fr_1.5fr_auto] gap-px px-4 py-1.5 border-b border-border bg-[#0a0a0a] shrink-0">
        {["TICKER","NAME","PRICE","CHG%","MKTCAP","VOLUME",""].map((h, i) => (
          <span key={i} className="font-terminal text-[8px] tracking-wider text-muted-foreground text-right first:text-left">{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {wLoad ? (
          Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-10 mx-4 my-1 bg-border" />)
        ) : watchlist.map((w) => {
          const q = quoteMap.get(w.symbol) as any;
          return (
            <div
              key={w.id}
              className="grid grid-cols-[2fr_3fr_1.5fr_1.5fr_2fr_1.5fr_auto] gap-px px-4 py-2.5 border-b border-border/50 hover:bg-white/5 items-center cursor-pointer group"
              onClick={() => onSymbol(w.symbol)}
              data-testid={`watchlist-row-${w.symbol}`}
            >
              <span className="font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)]">{w.symbol}</span>
              <span className="font-terminal text-[10px] text-muted-foreground truncate">{q?.name || w.name}</span>
              <span className="font-terminal text-[11px] tabular-nums text-right">{q ? `$${formatPrice(q.price)}` : "—"}</span>
              <span className={`font-terminal text-[11px] tabular-nums font-semibold text-right ${q ? pctClass(q.changePercent) : "text-muted-foreground"}`}>
                {q ? `${q.changePercent >= 0 ? "▲" : "▼"}${Math.abs(q.changePercent).toFixed(2)}%` : "—"}
              </span>
              <span className="font-terminal text-[10px] tabular-nums text-right text-muted-foreground">{q ? formatBig(q.marketCap) : "—"}</span>
              <span className="font-terminal text-[10px] tabular-nums text-right text-muted-foreground">{q ? `${(q.volume/1e6).toFixed(1)}M` : "—"}</span>
              <button
                onClick={e => { e.stopPropagation(); removeMut.mutate(w.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[hsl(0,100%,68%)] transition-all p-1"
                data-testid={`watchlist-remove-${w.symbol}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
