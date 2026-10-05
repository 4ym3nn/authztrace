import assert from "node:assert/strict";
import { it } from "node:test";
import { parseScenario } from "../src/index.js";
it("rejects unknown scenario fields", () =>
  assert.throws(() =>
    parseScenario(
      "version: 1\nname: unsafe\ntargets: {}\nsteps: [{kind: http, id: x, target: x, method: GET, path: /, surprise: true}]",
    ),
  ));
it("applies safe defaults", () => {
  const value = parseScenario(
    "version: 1\nname: minimal\ntargets:\n  api: {type: http, baseUrl: 'http://localhost'}\nsteps:\n  - {kind: http, id: x, target: api, method: GET, path: /}",
  );
  assert.deepEqual(value.actors, {});
});
it("bounds scenario source size", () =>
  assert.throws(() => parseScenario("#".repeat(262_145)), /256 KiB/u));
