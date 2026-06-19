import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  onNav: (v: ViewMode) => void;
  onOpenCmd: () => void;
}

const FKEYS: Array<{ key: string; label: string; sub: string; action: () => void }> = [];

export default function FunctionBar({ onNav, onOpenCmd }: Props) {
  const keys: Array<{ key: string; label: string; sub: string; action: () => void }> = [
    { key: "F1",  label: "HELP",  sub: "MENU",   action: onOpenCmd },
    { key: "F2",  label: "MRKT",  sub: "OVRVW",  action: () => onNav("market") },
    { key: "F3",  label: "QUOTE", sub: "DES",    action: () => onNav("quote") },
    { key: "F4",  label: "CHRT",  sub: "GP",     action: () => onNav("chart") },
    { key: "F5",  label: "NEWS",  sub: "N",      action: () => onNav("news") },
    { key: "F6",  label: "SCRN",  sub: "EQS",    action: () => onNav("screener") },
    { key: "F7",  label: "ECON",  sub: "ECST",   action: () => onNav("economics") },
    { key: "F8",  label: "AI",    sub: "AGENT",  action: () => onNav("agent") },
    { key: "F9",  label: "WATCH", sub: "WLT",    action: () => onNav("watchlist") },
    { key: "F10", label: "ALRT",  sub: "MON",    action: () => onNav("alerts") },
    { key: "F11", label: "PORT",  sub: "PRTU",   action: () => onNav("portfolio") },
    { key: "F12", label: "CMD",   sub: "/CMD",   action: onOpenCmd },
  ];

  return (
    <div className="flex items-stretch h-7 bg-[#050505] border-t border-border shrink-0">
      {keys.map((k, i) => (
        <button
          key={k.key}
          onClick={k.action}
          data-testid={`fkey-${k.key.toLowerCase()}`}
          className={`flex-1 flex items-center justify-center gap-1 border-r border-border/60 hover:bg-white/5 transition-colors group ${
            i === 0 || i === 11 ? "bg-[hsl(38,95%,50%)]/5" : ""
          }`}
        >
          <span className="font-terminal text-[7px] text-[hsl(38,95%,45%)] group-hover:text-[hsl(38,95%,60%)] tracking-wider">{k.key}</span>
          <span className="font-terminal text-[7px] text-muted-foreground group-hover:text-foreground tracking-widest uppercase">{k.sub}</span>
        </button>
      ))}
    </div>
  );
}
