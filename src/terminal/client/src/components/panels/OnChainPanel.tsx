import { useOnChain } from "@/lib/useFinance";
import { Skeleton } from "@/components/ui/skeleton";
import { Scan, ExternalLink } from "lucide-react";
import type { WhaleTransaction } from "@/lib/useFinance";

interface Props {
  symbol?: string;
  onSymbol?: (s: string) => void;
}

function truncateAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-6);
}

function typeLabel(type: WhaleTransaction["type"]): string {
  switch (type) {
    case "transfer": return "TRANSFER";
    case "exchange_in": return "EXCH IN";
    case "exchange_out": return "EXCH OUT";
    default: return "UNKNOWN";
  }
}

function typeColor(type: WhaleTransaction["type"]): string {
  switch (type) {
    case "transfer": return "text-muted-foreground";
    case "exchange_in": return "text-up";
    case "exchange_out": return "text-down";
    default: return "text-[hsl(38,95%,55%)]";
  }
}

function formatUSD(val: number | null): string {
  if (val == null) return "—";
  if (val >= 1e9) return "$" + (val / 1e9).toFixed(2) + "B";
  if (val >= 1e6) return "$" + (val / 1e6).toFixed(2) + "M";
  if (val >= 1e3) return "$" + (val / 1e3).toFixed(1) + "K";
  return "$" + val.toFixed(0);
}

export default function OnChainPanel({ symbol }: Props) {
  const { data, isLoading } = useOnChain(symbol);
  const txs = data?.transactions ?? [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-border" />
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-border" />)}
      </div>
    );
  }

  const totalUSD = txs.reduce((s, t) => s + (t.usdAmount ?? 0), 0);
  const uniqueChains = [...new Set(txs.map(t => t.blockchain))];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b border-border bg-[#060606] px-5 py-3">
        <div className="flex items-center gap-2">
          <Scan className="w-4 h-4 text-[hsl(38,95%,55%)]" />
          <span className="font-terminal text-xs font-bold tracking-wider text-foreground">ON-CHAIN WHALE ALERTS</span>
          {symbol && (
            <span className="font-terminal text-[10px] text-[hsl(38,95%,55%)] border border-[hsl(38,95%,55%)]/30 px-1.5 py-0.5">{symbol}</span>
          )}
          <span className="font-terminal text-[9px] text-muted-foreground ml-auto">{data?.source?.toUpperCase() ?? "LIVE"}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-border bg-[#060606]">
        <div className="text-center">
          <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">TRANSACTIONS</div>
          <div className="font-terminal text-lg font-bold tabular-nums mt-0.5">{txs.length}</div>
        </div>
        <div className="text-center">
          <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">TOTAL VALUE</div>
          <div className="font-terminal text-lg font-bold tabular-nums mt-0.5 text-[hsl(38,95%,55%)]">{formatUSD(totalUSD)}</div>
        </div>
        <div className="text-center">
          <div className="font-terminal text-[9px] text-muted-foreground tracking-wider">{uniqueChains.length > 1 ? "CHAINS" : "CHAIN"}</div>
          <div className="font-terminal text-lg font-bold tabular-nums mt-0.5">{uniqueChains.join(", ").toUpperCase()}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-[1fr_130px_130px_80px] gap-2 px-5 py-1.5 bg-[#040404] font-terminal text-[8px] text-muted-foreground tracking-wider border-b border-border/50">
          <span>TRANSACTION</span>
          <span className="text-right">FROM</span>
          <span className="text-right">TO</span>
          <span className="text-right">VALUE</span>
        </div>
        <div className="divide-y divide-border/50">
          {txs.slice(0, 25).map((tx) => (
            <div key={tx.id} className="grid grid-cols-[1fr_130px_130px_80px] gap-2 px-5 py-2 hover:bg-white/[0.02] items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-terminal text-[10px] font-bold text-foreground">{tx.symbol}</span>
                  <span className={`font-terminal text-[8px] tracking-wider ${typeColor(tx.type)}`}>{typeLabel(tx.type)}</span>
                  <span className="font-terminal text-[8px] text-muted-foreground">{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="font-terminal text-[8px] text-muted-foreground truncate mt-0.5">{tx.blockchain}</div>
              </div>
              <div className="text-right">
                <div className="font-terminal text-[10px] tabular-nums text-muted-foreground">{truncateAddr(tx.fromAddress)}</div>
                {tx.fromLabel && <div className="font-terminal text-[8px] text-[hsl(38,95%,55%)] truncate">{tx.fromLabel}</div>}
              </div>
              <div className="text-right">
                <div className="font-terminal text-[10px] tabular-nums text-muted-foreground">{truncateAddr(tx.toAddress)}</div>
                {tx.toLabel && <div className="font-terminal text-[8px] text-[hsl(38,95%,55%)] truncate">{tx.toLabel}</div>}
              </div>
              <div className="text-right font-terminal text-[10px] tabular-nums text-[hsl(38,95%,55%)]">{formatUSD(tx.usdAmount)}</div>
            </div>
          ))}
          {txs.length === 0 && (
            <div className="px-5 py-8 text-center font-terminal text-xs text-muted-foreground">No whale activity detected</div>
          )}
        </div>
      </div>
    </div>
  );
}
