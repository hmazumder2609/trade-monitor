import { useState, useRef, useEffect, useMemo } from "react";
import { Search, TrendingUp, LineChart, Newspaper, Bot, Filter, Star, BellRing, Globe2, Briefcase, LayoutDashboard, History, TerminalSquare, X } from "lucide-react";
import { getCommandAliasView, parseTerminalCommand, type ParsedTerminalCommand } from "@/lib/terminalCommands";
import type { ViewMode } from "@/lib/terminalTypes";

interface Props {
  onClose: () => void;
  onExecute: (command: ParsedTerminalCommand) => void;
}

interface QuickCommand {
  label: string;
  aliases: string[];
  view: ViewMode;
  icon: typeof LayoutDashboard;
}

const RECENTS_KEY = "terminal-command-recents";

const QUICK_COMMANDS: QuickCommand[] = [
  { label: "Market Overview", aliases: ["MRKT", "MARKET"], view: "market", icon: LayoutDashboard },
  { label: "Chart", aliases: ["GP", "CHRT", "CHART"], view: "chart", icon: LineChart },
  { label: "News Feed", aliases: ["NEWS", "N"], view: "news", icon: Newspaper },
  { label: "AI Agent", aliases: ["AI", "AGENT"], view: "agent", icon: Bot },
  { label: "Stock Screener", aliases: ["EQS", "SCRN", "SCREENER"], view: "screener", icon: Filter },
  { label: "Watchlist", aliases: ["WATCH", "WLT"], view: "watchlist", icon: Star },
  { label: "Price Alerts", aliases: ["ALRT", "MON", "ALERTS"], view: "alerts", icon: BellRing },
  { label: "Economics", aliases: ["ECON", "ECST"], view: "economics", icon: Globe2 },
  { label: "Portfolio", aliases: ["PORT", "PRTU"], view: "portfolio", icon: Briefcase },
];

const VIEW_LABELS: Record<ViewMode, string> = {
  market: "MARKET OVERVIEW",
  quote: "QUOTE",
  chart: "CHART",
  news: "NEWS",
  agent: "AI AGENT",
  screener: "SCREENER",
  watchlist: "WATCHLIST",
  alerts: "ALERTS",
  economics: "ECONOMICS",
  portfolio: "PORTFOLIO",
};

const POPULAR_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META", "JPM", "BTC-USD", "ETH-USD", "GC=F", "SPY"];

function loadRecentCommands(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(RECENTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentCommands(next: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

function formatCommandLabel(command: ParsedTerminalCommand): string {
  if (command.symbol) {
    return `${command.symbol} • ${VIEW_LABELS[command.view]}`;
  }
  return VIEW_LABELS[command.view];
}

export default function CommandBar({ onClose, onExecute }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>(() => loadRecentCommands());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsedCommand = useMemo(() => parseTerminalCommand(query), [query]);

  const filteredCmds = QUICK_COMMANDS.filter((command) => {
    const input = query.trim().toUpperCase();
    if (!input) return true;
    return command.label.toUpperCase().includes(input) || command.aliases.some((alias) => alias.includes(input));
  });

  const filteredTickers = POPULAR_TICKERS.filter((ticker) => {
    if (!query.trim()) return true;
    return ticker.includes(query.trim().toUpperCase());
  }).slice(0, 8);

  const recentResults = !query.trim()
    ? recentCommands
        .map((raw) => parseTerminalCommand(raw))
        .filter((command): command is ParsedTerminalCommand => Boolean(command))
        .map((command) => ({
          type: "recent" as const,
          label: formatCommandLabel(command),
          command,
          icon: History,
          meta: command.raw,
        }))
    : [];

  const commandPreview = parsedCommand && query.trim()
    ? [{
        type: "parsed" as const,
        label: formatCommandLabel(parsedCommand),
        command: parsedCommand,
        icon: TerminalSquare,
        meta: parsedCommand.symbol ? parsedCommand.raw : `GO ${parsedCommand.raw}`,
      }]
    : [];

  const quickResults = filteredCmds.map((command) => ({
    type: "quick" as const,
    label: command.label,
    command: { raw: command.aliases[0], view: command.view },
    icon: command.icon,
    meta: command.aliases.join(" · "),
  }));

  const tickerResults = filteredTickers.map((ticker) => ({
    type: "ticker" as const,
    label: ticker,
    command: { raw: ticker, symbol: ticker, view: "quote" as ViewMode },
    icon: TrendingUp,
    meta: "QUOTE",
  }));

  const allResults = [...commandPreview, ...recentResults, ...quickResults, ...tickerResults];

  const executeCommand = (command: ParsedTerminalCommand) => {
    const nextRecents = [command.raw, ...recentCommands.filter((item) => item !== command.raw)].slice(0, 8);
    setRecentCommands(nextRecents);
    saveRecentCommands(nextRecents);
    onExecute(command);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((index) => Math.min(index + 1, allResults.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (allResults[selected]) {
        executeCommand(allResults[selected].command);
        return;
      }
      if (parsedCommand) {
        executeCommand(parsedCommand);
      }
    }
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#0d0d0d] border border-[hsl(38,95%,50%)/40%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-[hsl(38,95%,55%)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value.toUpperCase());
              setSelected(0);
            }}
            onKeyDown={handleKey}
            placeholder="TYPE TICKER, FUNCTION, OR COMMAND..."
            className="flex-1 bg-transparent font-terminal text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            data-testid="cmd-input"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {allResults.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center font-terminal text-xs text-muted-foreground">
              UNRECOGNIZED COMMAND. TRY <span className="text-[hsl(38,95%,55%)]">AAPL GP</span> OR <span className="text-[hsl(38,95%,55%)]">MRKT</span>
            </div>
          )}

          {allResults.map((item, index) => {
            const Icon = item.icon;
            const isSelected = index === selected;
            const aliasView = getCommandAliasView(item.command.raw);
            return (
              <button
                key={`${item.type}-${item.command.raw}-${index}`}
                onClick={() => executeCommand(item.command)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-border/50 text-left transition-colors ${
                  isSelected ? "bg-[hsl(38,95%,50%)/10%] text-foreground" : "hover:bg-white/5 text-muted-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-terminal text-xs truncate">{item.label}</div>
                  <div className="font-terminal text-[8px] tracking-widest text-muted-foreground truncate">
                    {item.meta}
                  </div>
                </div>
                {"symbol" in item.command && item.command.symbol && (
                  <span className="font-terminal text-[8px] text-[hsl(38,95%,55%)] tracking-widest">
                    {VIEW_LABELS[item.command.view]}
                  </span>
                )}
                {!("symbol" in item.command && item.command.symbol) && aliasView && (
                  <span className="font-terminal text-[8px] text-[hsl(38,95%,55%)] tracking-widest">
                    GO
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 bg-black/30 border-t border-border">
          <span className="font-terminal text-[9px] text-muted-foreground">↑↓ NAVIGATE</span>
          <span className="font-terminal text-[9px] text-muted-foreground">↵ EXECUTE</span>
          <span className="font-terminal text-[9px] text-muted-foreground">EXAMPLES: AAPL DES · AAPL GP · MRKT</span>
          <span className="font-terminal text-[9px] text-muted-foreground ml-auto">/ TO OPEN</span>
        </div>
      </div>
    </div>
  );
}
