import assert from "node:assert/strict";
import { it } from "node:test";
import { toJUnit, toSarif, type RunResult } from "../src/index.js";
const result: RunResult = {
  scenario: "tenant < boundary",
  passed: false,
  startedAt: "2026-01-01T00:00:00Z",
  durationMs: 10,
  events: [
    {
      sequence: 1,
      stepId: "denied",
      kind: "http",
      passed: false,
      message: "expected 403, received 200",
    },
  ],
  findings: [
    {
      sequence: 1,
      stepId: "denied",
      kind: "http",
      passed: false,
      message: "expected 403, received 200",
    },
  ],
};
it("emits JUnit and SARIF findings", () => {
  assert.match(toJUnit(result), /failures="1"/);
  const sarif = JSON.parse(toSarif(result));
  assert.equal(sarif.runs[0].results[0].ruleId, "AUTHZTRACE_EXPECTATION");
});
