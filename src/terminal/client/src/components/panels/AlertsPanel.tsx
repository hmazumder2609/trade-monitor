import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAlerts, alertsQueryKey } from "@/lib/useAlerts";
import { BellRing, Plus, Trash2, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Alert } from "@shared/schema";

interface Props { onSymbol: (sym: string) => void }

export default function AlertsPanel({ onSymbol }: Props) {
  const [sym, setSym] = useState("");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useAlerts();

  const addMut = useMutation({
    mutationFn: async (data: { symbol: string; condition: string; price: number }) => {
      await apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: alertsQueryKey }); setSym(""); setPrice(""); }
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: alertsQueryKey }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sym.trim() || !price) return;
    addMut.mutate({ symbol: sym.trim().toUpperCase(), condition, price: parseFloat(price) });
  };

  const active = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050505]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-[#070707] shrink-0">
        <BellRing className="w-4 h-4 text-[hsl(38,95%,55%)]" />
        <span className="panel-label">PRICE ALERTS</span>
        <span className="font-terminal text-[9px] text-[hsl(142,100%,63%)] ml-2">{active.length} ACTIVE</span>
        {triggered.length > 0 && (
          <span className="font-terminal text-[9px] text-[hsl(38,95%,55%)] ml-1">{triggered.length} TRIGGERED</span>
        )}
      </div>

      {/* Create alert form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[#070707] shrink-0">
        <span className="font-terminal text-[9px] text-muted-foreground shrink-0">WHEN</span>
        <input
          value={sym}
          onChange={e => setSym(e.target.value.toUpperCase())}
          placeholder="TICKER"
          className="w-20 bg-[#0d0d0d] border border-border px-2 py-1.5 font-terminal text-[10px] focus:outline-none focus:border-[hsl(38,95%,50%)/50%]"
          data-testid="alert-sym-input"
        />
        <select
          value={condition}
          onChange={e => setCondition(e.target.value as "above" | "below")}
          className="bg-[#0d0d0d] border border-border px-2 py-1.5 font-terminal text-[10px] focus:outline-none"
        >
          <option value="above">CROSSES ABOVE</option>
          <option value="below">DROPS BELOW</option>
        </select>
        <span className="font-terminal text-[9px] text-muted-foreground">$</span>
        <input
          type="number"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="0.00"
          step="0.01"
          className="w-24 bg-[#0d0d0d] border border-border px-2 py-1.5 font-terminal text-[10px] focus:outline-none focus:border-[hsl(38,95%,50%)/50%]"
          data-testid="alert-price-input"
        />
        <button
          type="submit"
          disabled={!sym.trim() || !price || addMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(38,95%,50%)/15%] border border-[hsl(38,95%,50%)/40%] font-terminal text-[10px] text-[hsl(38,95%,55%)] hover:bg-[hsl(38,95%,50%)/25%] disabled:opacity-40 transition-colors"
          data-testid="alert-add-btn"
        >
          <Plus className="w-3 h-3" /> CREATE ALERT
        </button>
      </form>

      {/* Active alerts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 mx-4 my-2 bg-border" />)
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Bell className="w-8 h-8 text-muted-foreground/30" />
            <span className="font-terminal text-xs text-muted-foreground">NO ALERTS SET</span>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <div className="px-4 py-2 font-terminal text-[9px] tracking-widest text-[hsl(142,100%,63%)] border-b border-border bg-[#0a0a0a]">
                  ACTIVE ALERTS
                </div>
                {active.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-white/5 group" data-testid={`alert-${a.id}`}>
                    <div className="w-2 h-2 rounded-full bg-[hsl(142,100%,63%)] animate-pulse shrink-0" />
                    <button onClick={() => onSymbol(a.symbol)} className="font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)] hover:underline">
                      {a.symbol}
                    </button>
                    <span className={`font-terminal text-[10px] ${a.condition === "above" ? "text-up" : "text-down"}`}>
                      {a.condition === "above" ? "▲ ABOVE" : "▼ BELOW"}
                    </span>
                    <span className="font-terminal text-[11px] tabular-nums font-semibold">${a.price.toFixed(2)}</span>
                    <span className="font-terminal text-[8px] text-muted-foreground ml-2">SET {new Date(a.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => delMut.mutate(a.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[hsl(0,100%,68%)] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {triggered.length > 0 && (
              <div>
                <div className="px-4 py-2 font-terminal text-[9px] tracking-widest text-[hsl(38,95%,55%)] border-b border-border bg-[#0a0a0a]">
                  TRIGGERED
                </div>
                {triggered.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 opacity-60 group hover:opacity-80">
                    <div className="w-2 h-2 rounded-full border border-muted-foreground shrink-0" />
                    <span className="font-terminal text-[11px] font-bold text-muted-foreground">{a.symbol}</span>
                    <span className="font-terminal text-[10px] text-muted-foreground">{a.condition === "above" ? "▲" : "▼"} ${a.price.toFixed(2)}</span>
                    {a.triggerPrice !== null && (
                      <span className="font-terminal text-[10px] text-[hsl(38,95%,55%)]">LAST ${a.triggerPrice.toFixed(2)}</span>
                    )}
                    <span className="font-terminal text-[9px] text-[hsl(38,95%,55%)] ml-2">
                      {a.triggeredAt ? `TRIGGERED ${new Date(a.triggeredAt).toLocaleString()}` : "TRIGGERED"}
                    </span>
                    <button onClick={() => delMut.mutate(a.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[hsl(0,100%,68%)] transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
