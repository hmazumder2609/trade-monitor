import type { ViewMode } from "./terminalTypes";

export interface ParsedTerminalCommand {
  raw: string;
  symbol?: string;
  view: ViewMode;
}

const VIEW_ALIASES: Record<string, ViewMode> = {
  MRKT: "market",
  MARKET: "market",
  DES: "quote",
  QUOTE: "quote",
  GP: "chart",
  CHRT: "chart",
  CHART: "chart",
  NEWS: "news",
  N: "news",
  AI: "agent",
  AGENT: "agent",
  EQS: "screener",
  SCRN: "screener",
  SCREENER: "screener",
  WATCH: "watchlist",
  WLT: "watchlist",
  WATCHLIST: "watchlist",
  ALRT: "alerts",
  MON: "alerts",
  ALERTS: "alerts",
  ECON: "economics",
  ECST: "economics",
  ECONOMICS: "economics",
  PORT: "portfolio",
  PRTU: "portfolio",
  PORTFOLIO: "portfolio",
};

export function getCommandAliasView(token: string | undefined): ViewMode | null {
  if (!token) return null;
  return VIEW_ALIASES[token.toUpperCase()] ?? null;
}

export function parseTerminalCommand(input: string): ParsedTerminalCommand | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, " ");
  if (!raw) return null;

  const tokens = raw.split(" ");
  const singleTokenView = getCommandAliasView(tokens[0]);
  if (tokens.length === 1 && singleTokenView) {
    return { raw, view: singleTokenView };
  }

  const [first, second] = tokens;
  const secondView = getCommandAliasView(second);
  if (secondView) {
    return { raw, symbol: first, view: secondView };
  }

  return { raw, symbol: first, view: "quote" };
}
