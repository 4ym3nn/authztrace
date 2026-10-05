import assert from "node:assert/strict";
import { it } from "node:test";
import { loadScenario, runScenario } from "../../src/index.js";
it("executes a real MCP state transition and protected tool call", async () => {
  const scenario = await loadScenario("scenarios/mcp-revocation.yaml");
  const result = await runScenario(scenario, {
    allowCommandTargets: true,
    environment: { ...process.env, NODE: process.execPath },
  });
  assert.equal(result.passed, true, JSON.stringify(result.findings));
  assert.deepEqual(
    result.events.map((event) => event.observation?.error),
    [false, true],
  );
});
