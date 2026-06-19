import test from "node:test";
import assert from "node:assert/strict";

import { getMarketStatus, shouldIgnoreCommandShortcut } from "./terminalChrome";

test("getMarketStatus respects New York daylight saving time", () => {
  const status = getMarketStatus(new Date("2026-03-17T13:31:00Z"));
  assert.equal(status.label, "MKT OPEN");
  assert.equal(status.pulse, true);
});

test("getMarketStatus reports weekend closures", () => {
  const status = getMarketStatus(new Date("2026-03-15T15:00:00Z"));
  assert.equal(status.label, "WEEKEND");
  assert.equal(status.pulse, false);
});

test("shouldIgnoreCommandShortcut skips editable targets", () => {
  assert.equal(shouldIgnoreCommandShortcut({ tagName: "INPUT", isContentEditable: false }), true);
  assert.equal(shouldIgnoreCommandShortcut({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(shouldIgnoreCommandShortcut({ tagName: "DIV", isContentEditable: false }), false);
});
