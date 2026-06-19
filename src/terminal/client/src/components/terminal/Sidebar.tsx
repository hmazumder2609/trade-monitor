import {
  LayoutDashboard, TrendingUp, LineChart, Newspaper,
  Bot, Filter, Star, BellRing, Globe2, Briefcase,
  ChevronRight
} from "lucide-react";
import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  view: ViewMode;
  onNav: (v: ViewMode) => void;
}

const NAV = [
  { id: "market" as ViewMode,    icon: LayoutDashboard, label: "MARKET",    kbd: "M" },
  { id: "quote" as ViewMode,     icon: TrendingUp,      label: "QUOTE",     kbd: "Q" },
  { id: "chart" as ViewMode,     icon: LineChart,       label: "CHART",     kbd: "G" },
  { id: "news" as ViewMode,      icon: Newspaper,       label: "NEWS",      kbd: "N" },
  { id: "agent" as ViewMode,     icon: Bot,             label: "AI AGENT",  kbd: "A" },
  { id: "screener" as ViewMode,  icon: Filter,          label: "SCREENER",  kbd: "S" },
  { id: "watchlist" as ViewMode, icon: Star,            label: "WATCHLIST", kbd: "W" },
  { id: "alerts" as ViewMode,    icon: BellRing,        label: "ALERTS",    kbd: "!" },
  { id: "economics" as ViewMode, icon: Globe2,          label: "ECONOMICS", kbd: "E" },
  { id: "portfolio" as ViewMode, icon: Briefcase,       label: "PORTFOLIO", kbd: "P" },
];

export default function Sidebar({ view, onNav }: Props) {
  return (
    <aside className="w-12 bg-[#060606] border-r border-border flex flex-col shrink-0 overflow-y-auto scrollbar-thin">
      {NAV.map(({ id, icon: Icon, label, kbd }) => (
        <button
          key={id}
          data-testid={`sidebar-${id}`}
          onClick={() => onNav(id)}
          title={`${label}  [${kbd}]`}
          className={`group relative flex flex-col items-center justify-center w-full py-3 border-b border-border transition-colors ${
            view === id
              ? "bg-[hsl(38,95%,50%)/12%] text-[hsl(38,95%,55%)]"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          {view === id && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[hsl(38,95%,55%)]" />
          )}
          <Icon className="w-4 h-4" strokeWidth={view === id ? 2 : 1.5} />
          <span className="font-terminal text-[7px] mt-1 tracking-widest leading-none">
            {kbd}
          </span>
        </button>
      ))}
    </aside>
  );
}
