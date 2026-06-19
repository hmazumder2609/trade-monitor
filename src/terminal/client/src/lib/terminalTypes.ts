export type ViewMode =
  | "market"
  | "quote"
  | "chart"
  | "news"
  | "agent"
  | "screener"
  | "watchlist"
  | "alerts"
  | "economics"
  | "portfolio";

export type PaneId = "primary" | "secondary";

export interface PaneState {
  view: ViewMode;
  symbol: string;
}

export interface WorkspaceState {
  primary: PaneState;
  secondary: PaneState | null;
  focusedPane: PaneId;
}
