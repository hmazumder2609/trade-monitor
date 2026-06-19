import test from "node:test";
import assert from "node:assert/strict";

import {
  closeSecondaryPane,
  createInitialWorkspace,
  navigateFocusedPane,
  openSecurityView,
  openSymbolInWorkspace,
} from "./terminalWorkspace";

test("openSymbolInWorkspace preserves broad primary context by opening a quote in secondary", () => {
  const workspace = createInitialWorkspace();
  const next = openSymbolInWorkspace(workspace, "MSFT");

  assert.deepEqual(next, {
    primary: { view: "market", symbol: "AAPL" },
    secondary: { view: "quote", symbol: "MSFT" },
    focusedPane: "secondary",
  });
});

test("openSecurityView opens a split pane from broad views", () => {
  const workspace = createInitialWorkspace();
  const next = openSecurityView(workspace, "NVDA", "chart");

  assert.deepEqual(next.secondary, { view: "chart", symbol: "NVDA" });
  assert.equal(next.focusedPane, "secondary");
});

test("navigateFocusedPane updates the focused pane only", () => {
  const workspace = openSecurityView(createInitialWorkspace(), "AAPL", "chart");
  const next = navigateFocusedPane(workspace, "news");

  assert.deepEqual(next.primary, { view: "market", symbol: "AAPL" });
  assert.deepEqual(next.secondary, { view: "news", symbol: "AAPL" });
  assert.equal(next.focusedPane, "secondary");
});

test("openSymbolInWorkspace replaces the current security pane when already focused on one", () => {
  const workspace = openSecurityView(createInitialWorkspace(), "AAPL", "chart");
  const next = openSymbolInWorkspace(workspace, "TSLA");

  assert.deepEqual(next.secondary, { view: "quote", symbol: "TSLA" });
  assert.equal(next.focusedPane, "secondary");
});

test("closeSecondaryPane collapses back to a single focused primary pane", () => {
  const workspace = openSecurityView(createInitialWorkspace(), "AAPL", "news");
  const next = closeSecondaryPane(workspace);

  assert.deepEqual(next, {
    primary: { view: "market", symbol: "AAPL" },
    secondary: null,
    focusedPane: "primary",
  });
});


test("openSecurityView preserves broad primary context when a secondary pane already exists", () => {
  const workspace = {
    primary: { view: "market", symbol: "AAPL" },
    secondary: { view: "quote", symbol: "AAPL" },
    focusedPane: "primary" as const,
  };
  const next = openSecurityView(workspace, "MSFT", "news");

  assert.deepEqual(next, {
    primary: { view: "market", symbol: "AAPL" },
    secondary: { view: "news", symbol: "MSFT" },
    focusedPane: "secondary",
  });
});