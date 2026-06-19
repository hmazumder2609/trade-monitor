import type { ReactNode } from "react";
import { Columns2, Focus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaneId, PaneState, ViewMode } from "@/lib/terminalTypes";

interface Props {
  paneId: PaneId;
  pane: PaneState;
  focused: boolean;
  canClose: boolean;
  onFocus: () => void;
  onClose?: () => void;
  children: ReactNode;
}

const VIEW_META: Record<ViewMode, { label: string; code: string; needsSymbol: boolean }> = {
  market: { label: "MARKET OVERVIEW", code: "MRKT", needsSymbol: false },
  quote: { label: "QUOTE", code: "DES", needsSymbol: true },
  chart: { label: "CHART", code: "GP", needsSymbol: true },
  news: { label: "NEWS", code: "NEWS", needsSymbol: true },
  agent: { label: "AI AGENT", code: "AI", needsSymbol: true },
  screener: { label: "SCREENER", code: "EQS", needsSymbol: false },
  watchlist: { label: "WATCHLIST", code: "WLT", needsSymbol: false },
  alerts: { label: "ALERT MONITOR", code: "MON", needsSymbol: false },
  economics: { label: "ECONOMICS", code: "ECST", needsSymbol: false },
  portfolio: { label: "PORTFOLIO", code: "PRTU", needsSymbol: false },
};

export default function WorkspacePane({ paneId, pane, focused, canClose, onFocus, onClose, children }: Props) {
  const meta = VIEW_META[pane.view];

  return (
    <section
      className={cn(
        "h-full flex flex-col bg-background border-l border-border/60",
        focused && "ring-1 ring-inset ring-[hsl(38,95%,50%)]/35",
      )}
      onMouseDown={onFocus}
      data-testid={`workspace-pane-${paneId}`}
    >
      <header className="h-8 shrink-0 flex items-center gap-2 px-3 border-b border-border bg-[#070707]">
        <Columns2 className="w-3 h-3 text-muted-foreground" />
        <span className="font-terminal text-[8px] tracking-widest text-muted-foreground uppercase">{paneId}</span>
        <span className="font-terminal text-[9px] tracking-widest text-[hsl(38,95%,55%)]">{meta.code}</span>
        <span className="font-terminal text-[10px] text-foreground truncate">{meta.label}</span>
        {meta.needsSymbol && (
          <span className="font-terminal text-[9px] text-[hsl(186,80%,55%)] border border-[hsl(186,80%,55%)]/25 px-1.5 py-0.5 ml-1">
            {pane.symbol}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {!focused && (
            <button
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onFocus(); }}
              className="flex items-center gap-1 px-1.5 py-0.5 font-terminal text-[8px] tracking-widest text-muted-foreground hover:text-foreground border border-border"
              data-testid={`workspace-focus-${paneId}`}
            >
              <Focus className="w-2.5 h-2.5" /> FOCUS
            </button>
          )}
          {canClose && onClose && (
            <button
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onClose(); }}
              className="flex items-center gap-1 px-1.5 py-0.5 font-terminal text-[8px] tracking-widest text-muted-foreground hover:text-[hsl(0,100%,68%)] border border-border"
              data-testid={`workspace-close-${paneId}`}
            >
              <X className="w-2.5 h-2.5" /> CLOSE
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}
