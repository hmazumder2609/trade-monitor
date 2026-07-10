import { useEffect, useRef } from "react";
import { TrendingUp, LineChart, Newspaper, CandlestickChart, Scan, MessageCircle } from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  symbol: string;
  onNav: (view: ViewMode) => void;
  onClose: () => void;
}

const SYMBOL_VIEWS: Array<{ view: ViewMode; icon: typeof TrendingUp; label: string; desc: string }> = [
  { view: "quote",    icon: TrendingUp,      label: "QUOTE",     desc: "Price & summary" },
  { view: "chart",    icon: LineChart,       label: "CHART",     desc: "Technical analysis" },
  { view: "news",     icon: Newspaper,       label: "NEWS",      desc: "Headlines & articles" },
  { view: "options",  icon: CandlestickChart, label: "OPTIONS",   desc: "Options flow" },
  { view: "onchain",  icon: Scan,            label: "ON-CHAIN",  desc: "Blockchain data" },
  { view: "sentiment",icon: MessageCircle,   label: "SENTIMENT", desc: "Social sentiment" },
];

export default function SymbolDropdown({ symbol, onNav, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full w-[240px] bg-[#090909] border border-border/60 shadow-2xl z-50"
    >
      <div className="px-3 py-2 border-b border-border/40">
        <span className="font-terminal text-[9px] tracking-[0.15em] text-muted-foreground">OPEN VIEW FOR</span>
        <span className="font-terminal text-[11px] font-bold text-amber-500 ml-2">{symbol}</span>
      </div>
      <div className="py-1">
        {SYMBOL_VIEWS.map(({ view, icon: Icon, label, desc }) => (
          <button
            key={view}
            onClick={() => { onNav(view); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-terminal text-[10px] tracking-[0.1em] text-foreground/90">{label}</div>
              <div className="font-terminal text-[8px] text-muted-foreground/60">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
