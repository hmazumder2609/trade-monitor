import { useState } from "react";
import { useScreener } from "@/lib/useFinance";
import { formatPrice, formatPct, formatBig, pctClass, SCREENER_SECTORS } from "@/lib/finance";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";

interface Props { onSymbol: (sym: string) => void }

type SortField = "symbol" | "price" | "changePercent" | "marketCap" | "pe" | "volume";
type SortDir = "asc" | "desc";

export default function ScreenerPanel({ onSymbol }: Props) {
  const [sector, setSector] = useState("All");
  const [sortField, setSortField] = useState<SortField>("changePercent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minPe, setMinPe] = useState("");
  const [maxPe, setMaxPe] = useState("");

  const filters: Record<string, string> = { sector };
  if (minPe) filters.minPe = minPe;
  if (maxPe) filters.maxPe = maxPe;

  const { data: stocks = [], isLoading } = useScreener(filters);

  const sorted = [...stocks].sort((a: any, b: any) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th className="text-left py-2 px-3 cursor-pointer hover:text-[hsl(38,95%,55%)] select-none" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        <span className="font-terminal text-[9px] tracking-wider">{label}</span>
        {sortField === field && (
          <span className="text-[hsl(38,95%,55%)]">{sortDir === "desc" ? "▼" : "▲"}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#050505]">
      {/* Filters */}
      <div className="shrink-0 border-b border-border bg-[#070707]">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="panel-label">FILTERS</span>
          <div className="ml-2 flex items-center gap-2">
            <label className="font-terminal text-[9px] text-muted-foreground">MIN P/E</label>
            <input value={minPe} onChange={e => setMinPe(e.target.value)} className="w-14 bg-[#0d0d0d] border border-border px-2 py-0.5 font-terminal text-[10px] focus:outline-none focus:border-[hsl(38,95%,50%)/50%]" placeholder="—" />
            <label className="font-terminal text-[9px] text-muted-foreground">MAX P/E</label>
            <input value={maxPe} onChange={e => setMaxPe(e.target.value)} className="w-14 bg-[#0d0d0d] border border-border px-2 py-0.5 font-terminal text-[10px] focus:outline-none focus:border-[hsl(38,95%,50%)/50%]" placeholder="—" />
          </div>
          <span className="ml-auto font-terminal text-[9px] text-muted-foreground">{sorted.length} RESULTS</span>
        </div>
        <div className="flex items-center gap-px overflow-x-auto scrollbar-thin px-2 py-1">
          {["All", ...SCREENER_SECTORS].map(s => (
            <button key={s} onClick={() => setSector(s)}
              className={`px-2.5 py-1 font-terminal text-[9px] whitespace-nowrap border-r border-border transition-colors ${
                sector === s ? "bg-[hsl(38,95%,50%)/15%] text-[hsl(38,95%,55%)]" : "text-muted-foreground hover:text-foreground"
              }`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-8 bg-border" />)}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#070707] border-b border-border z-10">
              <tr className="text-muted-foreground">
                <SortHeader field="symbol" label="TICKER" />
                <th className="text-left py-2 px-3 font-terminal text-[9px] tracking-wider text-muted-foreground">NAME</th>
                <SortHeader field="price" label="PRICE" />
                <SortHeader field="changePercent" label="CHG%" />
                <SortHeader field="marketCap" label="MKTCAP" />
                <SortHeader field="pe" label="P/E" />
                <SortHeader field="volume" label="VOLUME" />
                <th className="text-left py-2 px-3 font-terminal text-[9px] tracking-wider text-muted-foreground">SECTOR</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s: any) => (
                <tr
                  key={s.symbol}
                  onClick={() => onSymbol(s.symbol)}
                  className="border-b border-border/50 hover:bg-white/5 cursor-pointer"
                  data-testid={`screener-row-${s.symbol}`}
                >
                  <td className="py-2 px-3 font-terminal text-[11px] font-bold text-[hsl(38,95%,55%)]">{s.symbol}</td>
                  <td className="py-2 px-3 font-terminal text-[10px] text-muted-foreground max-w-[180px] truncate">{s.name}</td>
                  <td className="py-2 px-3 font-terminal text-[11px] tabular-nums">${formatPrice(s.price)}</td>
                  <td className={`py-2 px-3 font-terminal text-[11px] tabular-nums font-semibold ${pctClass(s.changePercent)}`}>
                    {s.changePercent >= 0 ? "▲" : "▼"} {Math.abs(s.changePercent).toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 font-terminal text-[11px] tabular-nums">{formatBig(s.marketCap)}</td>
                  <td className="py-2 px-3 font-terminal text-[11px] tabular-nums">{s.pe !== null ? s.pe.toFixed(1) : "—"}</td>
                  <td className="py-2 px-3 font-terminal text-[10px] tabular-nums text-muted-foreground">{(s.volume / 1e6).toFixed(1)}M</td>
                  <td className="py-2 px-3 font-terminal text-[9px] text-[hsl(186,80%,55%)]">{s.sector || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
