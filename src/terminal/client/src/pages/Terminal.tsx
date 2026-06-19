import { useState, useCallback, useEffect, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "@/components/terminal/TopBar";
import TickerTape from "@/components/terminal/TickerTape";
import Sidebar from "@/components/terminal/Sidebar";
import MarketOverview from "@/components/panels/MarketOverview";
import QuotePanel from "@/components/panels/QuotePanel";
import ChartPanel from "@/components/panels/ChartPanel";
import NewsPanel from "@/components/panels/NewsPanel";
import AgentPanel from "@/components/panels/AgentPanel";
import ScreenerPanel from "@/components/panels/ScreenerPanel";
import WatchlistPanel from "@/components/panels/WatchlistPanel";
import AlertsPanel from "@/components/panels/AlertsPanel";
import EconomicsPanel from "@/components/panels/EconomicsPanel";
import PortfolioPanel from "@/components/panels/PortfolioPanel";
import CommandBar from "@/components/terminal/CommandBar";
import FunctionBar from "@/components/terminal/FunctionBar";
import WorkspacePane from "@/components/terminal/WorkspacePane";
import type { ParsedTerminalCommand } from "@/lib/terminalCommands";
import { shouldIgnoreCommandShortcut } from "@/lib/terminalChrome";
import { createInitialWorkspace, closeSecondaryPane, focusPane, navigateFocusedPane, openSecurityView, openSymbolInWorkspace } from "@/lib/terminalWorkspace";
import type { PaneId, PaneState, WorkspaceState, ViewMode } from "@/lib/terminalTypes";

export type { ViewMode } from "@/lib/terminalTypes";

/** Read ?symbol= from the URL so trade-monitor can pass an active symbol on launch. */
function getInitialSymbol(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const sym = params.get("symbol");
    return sym ? sym.toUpperCase() : "AAPL";
  } catch {
    return "AAPL";
  }
}

export default function Terminal() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
    const initial = createInitialWorkspace();
    const sym = getInitialSymbol();
    // If a symbol was passed, pre-load chart view for it
    if (sym !== "AAPL") {
      return { ...initial, primary: { view: "chart", symbol: sym } };
    }
    return initial;
  });
  const [cmdOpen, setCmdOpen] = useState(false);

  const activePane = useMemo(() => {
    if (workspace.focusedPane === "secondary" && workspace.secondary) {
      return workspace.secondary;
    }
    return workspace.primary;
  }, [workspace]);

  const handleSymbol = useCallback((sym: string) => {
    setWorkspace((current) => openSymbolInWorkspace(current, sym));
  }, []);

  const handleNav = useCallback((view: ViewMode) => {
    setWorkspace((current) => navigateFocusedPane(current, view));
  }, []);

  const handlePaneFocus = useCallback((paneId: PaneId) => {
    setWorkspace((current) => focusPane(current, paneId));
  }, []);

  const handlePaneSymbol = useCallback((paneId: PaneId, symbol: string) => {
    setWorkspace((current) => openSymbolInWorkspace(focusPane(current, paneId), symbol));
  }, []);

  const handlePaneNav = useCallback((paneId: PaneId, view: ViewMode) => {
    setWorkspace((current) => navigateFocusedPane(focusPane(current, paneId), view));
  }, []);

  const handleCommand = useCallback((command: ParsedTerminalCommand) => {
    setWorkspace((current) => {
      if (command.symbol) {
        return openSecurityView(current, command.symbol, command.view);
      }
      return navigateFocusedPane(current, command.view);
    });
    setCmdOpen(false);
  }, []);

  const renderPaneContent = useCallback((paneId: PaneId, pane: PaneState) => {
    const onSymbol = (symbol: string) => handlePaneSymbol(paneId, symbol);
    const onNav = (view: ViewMode) => handlePaneNav(paneId, view);

    switch (pane.view) {
      case "market":
        return <MarketOverview onSymbol={onSymbol} onNav={onNav} />;
      case "quote":
        return <QuotePanel symbol={pane.symbol} onNav={onNav} />;
      case "chart":
        return <ChartPanel symbol={pane.symbol} onSymbol={(nextSymbol) => setWorkspace((current) => openSecurityView(focusPane(current, paneId), nextSymbol, "chart"))} />;
      case "news":
        return <NewsPanel symbol={pane.symbol} />;
      case "agent":
        return <AgentPanel onSymbol={onSymbol} />;
      case "screener":
        return <ScreenerPanel onSymbol={onSymbol} />;
      case "watchlist":
        return <WatchlistPanel onSymbol={onSymbol} />;
      case "alerts":
        return <AlertsPanel onSymbol={onSymbol} />;
      case "economics":
        return <EconomicsPanel />;
      case "portfolio":
        return <PortfolioPanel onSymbol={onSymbol} />;
      default:
        return <MarketOverview onSymbol={onSymbol} onNav={onNav} />;
    }
  }, [handlePaneNav, handlePaneSymbol]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !shouldIgnoreCommandShortcut(e.target)) {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TopBar
        activeSymbol={activePane.symbol}
        view={activePane.view}
        onNav={handleNav}
        onSymbol={handleSymbol}
        onOpenCmd={() => setCmdOpen(true)}
      />

      <TickerTape onSymbol={handleSymbol} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar view={activePane.view} onNav={handleNav} />
        <main className="flex-1 min-w-0 overflow-hidden bg-background">
          {workspace.secondary ? (
            <PanelGroup direction="horizontal" autoSaveId="terminal-workspace-layout" className="h-full">
              <Panel defaultSize={55} minSize={35}>
                <WorkspacePane
                  paneId="primary"
                  pane={workspace.primary}
                  focused={workspace.focusedPane === "primary"}
                  canClose={false}
                  onFocus={() => handlePaneFocus("primary")}
                >
                  {renderPaneContent("primary", workspace.primary)}
                </WorkspacePane>
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-[hsl(38,95%,50%)]/40 transition-colors" />
              <Panel defaultSize={45} minSize={30}>
                <WorkspacePane
                  paneId="secondary"
                  pane={workspace.secondary}
                  focused={workspace.focusedPane === "secondary"}
                  canClose={true}
                  onFocus={() => handlePaneFocus("secondary")}
                  onClose={() => setWorkspace((current) => closeSecondaryPane(current))}
                >
                  {renderPaneContent("secondary", workspace.secondary)}
                </WorkspacePane>
              </Panel>
            </PanelGroup>
          ) : (
            <WorkspacePane
              paneId="primary"
              pane={workspace.primary}
              focused={true}
              canClose={false}
              onFocus={() => handlePaneFocus("primary")}
            >
              {renderPaneContent("primary", workspace.primary)}
            </WorkspacePane>
          )}
        </main>
      </div>

      {cmdOpen && (
        <CommandBar
          onClose={() => setCmdOpen(false)}
          onExecute={handleCommand}
        />
      )}

      <FunctionBar onNav={handleNav} onOpenCmd={() => setCmdOpen(true)} />
    </div>
  );
}
