import test from "node:test";
import assert from "node:assert/strict";

import { parseTerminalCommand } from "./terminalCommands";

test("parseTerminalCommand treats a bare ticker as a quote command", () => {
  assert.deepEqual(parseTerminalCommand("aapl"), {
    raw: "AAPL",
    symbol: "AAPL",
    view: "quote",
  });
});

test("parseTerminalCommand maps Bloomberg-style function aliases", () => {
  assert.deepEqual(parseTerminalCommand("AAPL GP"), {
    raw: "AAPL GP",
    symbol: "AAPL",
    view: "chart",
  });

  assert.deepEqual(parseTerminalCommand("MSFT DES"), {
    raw: "MSFT DES",
    symbol: "MSFT",
    view: "quote",
  });

  assert.deepEqual(parseTerminalCommand("BTC-USD NEWS"), {
    raw: "BTC-USD NEWS",
    symbol: "BTC-USD",
    view: "news",
  });
});

test("parseTerminalCommand supports standalone navigation aliases", () => {
  assert.deepEqual(parseTerminalCommand("MRKT"), {
    raw: "MRKT",
    view: "market",
  });

  assert.deepEqual(parseTerminalCommand("ECST"), {
    raw: "ECST",
    view: "economics",
  });
});

test("parseTerminalCommand returns null for empty input", () => {
  assert.equal(parseTerminalCommand("   "), null);
});
