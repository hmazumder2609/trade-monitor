import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Terminal, LayoutDashboard, Filter, Star, BellRing, Globe2, Briefcase, Bot, MessageCircle, CandlestickChart, Scan, ChevronDown } from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";
import { getMarketStatus } from "@/lib/terminalChrome";
import { useAlerts } from "@/lib/useAlerts";

const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? "/";

interface Props {
  activeSymbol: string;
  view: ViewMode;
  onNav: (v: ViewMode) => void;
  onSymbol: (sym: string) => void;
  onOpenCmd: () => void;
  onToggleSymbolDropdown: () => void;
}

function formatRelativeTime(value: string | Date | null) {
  if (!value) return "";
  const iso = typeof value === "string" ? value : value.toISOString();
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

const GLOBAL_TABS: Array<{ id: ViewMode; icon: typeof LayoutDashboard; label: string }> = [
  { id: "market",    icon: LayoutDashboard,    label: "MRKT"  },
  { id: "screener",  icon: Filter,             label: "SCRN"  },
  { id: "watchlist", icon: Star,               label: "WLT"   },
  { id: "alerts",    icon: BellRing,           label: "ALRT"  },
  { id: "economics", icon: Globe2,             label: "ECON"  },
  { id: "portfolio", icon: Briefcase,          label: "PORT"  },
  { id: "agent",     icon: Bot,                label: "AGT"   },
  { id: "sentiment", icon: MessageCircle,      label: "SENT"  },
  { id: "options",   icon: CandlestickChart,   label: "OPTN"  },
  { id: "onchain",   icon: Scan,               label: "CHAIN" },
];

export default function TopBar({ activeSymbol, view, onNav, onSymbol, onOpenCmd, onToggleSymbolDropdown }: Props) {
  const [clock, setClock] = useState(() => new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const mktStatus = getMarketStatus(clock);
  const { data: alerts = [] } = useAlerts();

  const triggeredAlerts = useMemo(() => {
    return alerts
      .filter((alert) => alert.triggered)
      .sort((a, b) => +new Date(b.triggeredAt ?? 0) - +new Date(a.triggeredAt ?? 0))
      .slice(0, 5);
  }, [alerts]);
  const activeAlertCount = alerts.filter((alert) => !alert.triggered).length;

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [notificationsOpen]);

  const timeStr = clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateStr = clock.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();

  return (
    <header className="flex items-center gap-0 h-9 bg-[#0a0a0a] border-b border-border shrink-0">
      <a
        href={DASHBOARD_URL}
        className="flex items-center gap-1.5 px-3 h-full border-r border-border hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Return to Dashboard"
        data-testid="back-to-dashboard"
      >
        <LayoutDashboard className="w-3 h-3" />
        <span className="font-terminal text-[9px] tracking-widest hidden sm:inline">DASHBOARD</span>
      </a>

      <button
        onClick={onOpenCmd}
        className="flex items-center gap-2 px-3 h-full border-r border-border bg-[hsl(38,95%,50%)] hover:bg-[hsl(38,95%,45%)] transition-colors shrink-0"
        title="Search ticker or command"
        data-testid="cmd-open"
      >
        <Terminal className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
        <span className="font-terminal text-xs font-bold tracking-widest text-black">TERMINAL</span>
      </button>

      <nav className="flex items-center h-full overflow-x-auto scrollbar-thin flex-1">
        {GLOBAL_TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            data-testid={`nav-${id}`}
            onClick={() => onNav(id)}
            className={`flex items-center gap-1.5 h-full px-3 font-terminal text-[10px] tracking-widest border-r border-border transition-colors shrink-0 ${
              view === id
                ? "bg-amber-500/10 text-[hsl(38,95%,60%)] border-b-2 border-b-[hsl(38,95%,50%)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={view === id ? 2 : 1.5} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-1.5 px-3 h-full border-l border-border">
        {mktStatus.pulse && (
          <div className="relative w-1.5 h-1.5">
            <div className={`absolute inset-0 rounded-full ${mktStatus.color === "text-up" ? "bg-[hsl(142,100%,63%)]" : "bg-[hsl(38,95%,50%)]"} animate-ping opacity-75`} />
            <div className={`w-1.5 h-1.5 rounded-full ${mktStatus.color === "text-up" ? "bg-[hsl(142,100%,63%)]" : "bg-[hsl(38,95%,50%)]"}`} />
          </div>
        )}
        <span className={`font-terminal text-[9px] tracking-widest font-semibold ${mktStatus.color}`}>{mktStatus.label}</span>
      </div>

      <div className="relative h-full">
        <button
          onClick={onToggleSymbolDropdown}
          className="flex items-center gap-1.5 px-2.5 h-full border-x border-border hover:bg-white/5 transition-colors"
          data-testid="active-symbol"
        >
          <span className="font-terminal text-[9px] text-muted-foreground">ACTIVE</span>
          <span className="font-terminal text-xs font-bold text-amber-500">{activeSymbol}</span>
          <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/60" />
        </button>
      </div>

      <div ref={notificationsRef} className="relative h-full border-r border-border">
        <button
          onClick={() => setNotificationsOpen((value) => !value)}
          className="relative flex items-center justify-center w-11 h-full hover:bg-white/5 text-muted-foreground hover:text-[hsl(38,95%,55%)]"
          data-testid="nav-alerts"
        >
          <Bell className="w-3.5 h-3.5" />
          {triggeredAlerts.length > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[hsl(0,100%,63%)] text-[8px] leading-4 text-white font-terminal text-center">
              {triggeredAlerts.length}
            </span>
          )}
        </button>

        {notificationsOpen && (
          <div className="absolute right-0 top-full w-[340px] bg-[#090909] border border-border shadow-2xl z-50">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div>
                <div className="panel-label">NOTIFICATION CENTER</div>
                <div className="font-terminal text-[8px] text-muted-foreground mt-1">
                  {activeAlertCount} ACTIVE · {triggeredAlerts.length} TRIGGERED
                </div>
              </div>
              <button
                onClick={() => { setNotificationsOpen(false); onNav("alerts"); }}
                className="font-terminal text-[8px] tracking-widest text-[hsl(38,95%,55%)] hover:text-foreground"
              >
                VIEW ALL
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {triggeredAlerts.length === 0 ? (
                <div className="px-3 py-6 font-terminal text-[10px] text-muted-foreground text-center">
                  NO TRIGGERED ALERTS
                </div>
              ) : (
                triggeredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => {
                      setNotificationsOpen(false);
                      onSymbol(alert.symbol);
                      onNav("quote");
                    }}
                    className="w-full text-left px-3 py-3 border-b border-border/60 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-terminal text-[10px] font-bold text-[hsl(38,95%,55%)]">{alert.symbol}</span>
                      <span className={`font-terminal text-[9px] ${alert.condition === "above" ? "text-up" : "text-down"}`}>
                        {alert.condition === "above" ? "▲ ABOVE" : "▼ BELOW"}
                      </span>
                      <span className="font-terminal text-[9px] text-muted-foreground">${alert.price.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-terminal text-[8px] text-muted-foreground">
                      {alert.triggerPrice !== null && <span>LAST ${alert.triggerPrice.toFixed(2)}</span>}
                      <span>{formatRelativeTime(alert.triggeredAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end justify-center px-3 h-full font-terminal">
        <span className="text-[10px] text-foreground tabular-nums">{timeStr}</span>
        <span className="text-[9px] text-muted-foreground">{dateStr}</span>
      </div>
    </header>
  );
}
