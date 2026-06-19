import type { PaneId, ViewMode, WorkspaceState } from "./terminalTypes";

const SECURITY_VIEWS: ViewMode[] = ["quote", "chart", "news", "agent"];

function isSecurityView(view: ViewMode): boolean {
  return SECURITY_VIEWS.includes(view);
}

function getFocusedPaneKey(workspace: WorkspaceState): PaneId {
  return workspace.focusedPane === "secondary" && workspace.secondary ? "secondary" : "primary";
}

export function createInitialWorkspace(): WorkspaceState {
  return {
    primary: { view: "market", symbol: "AAPL" },
    secondary: null,
    focusedPane: "primary",
  };
}

export function focusPane(workspace: WorkspaceState, pane: PaneId): WorkspaceState {
  if (pane === "secondary" && !workspace.secondary) return workspace;
  return { ...workspace, focusedPane: pane };
}

export function navigateFocusedPane(workspace: WorkspaceState, view: ViewMode): WorkspaceState {
  const targetPane = getFocusedPaneKey(workspace);
  if (targetPane === "secondary" && workspace.secondary) {
    return {
      ...workspace,
      secondary: { ...workspace.secondary, view },
      focusedPane: "secondary",
    };
  }

  return {
    ...workspace,
    primary: { ...workspace.primary, view },
    focusedPane: "primary",
  };
}

export function openSecurityView(workspace: WorkspaceState, symbol: string, view: ViewMode): WorkspaceState {
  const normalizedSymbol = symbol.toUpperCase();
  const shouldSplit = !workspace.secondary && !isSecurityView(workspace.primary.view);

  if (shouldSplit || workspace.secondary) {
    return {
      ...workspace,
      secondary: { view, symbol: normalizedSymbol },
      focusedPane: "secondary",
    };
  }

  return {
    ...workspace,
    primary: { view, symbol: normalizedSymbol },
    focusedPane: "primary",
  };
}

export function openSymbolInWorkspace(workspace: WorkspaceState, symbol: string): WorkspaceState {
  return openSecurityView(workspace, symbol, "quote");
}

export function closeSecondaryPane(workspace: WorkspaceState): WorkspaceState {
  return {
    ...workspace,
    secondary: null,
    focusedPane: "primary",
  };
}
