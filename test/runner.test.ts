import assert from "node:assert/strict";
import { once } from "node:events";
import { afterEach, it } from "node:test";
import type { Server } from "node:http";
import {
  createReferenceServer,
  type ReferenceMode,
} from "../examples/reference-server.js";
import { loadScenario, runScenario } from "../src/index.js";
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});
async function execute(mode: ReferenceMode) {
  const server = createReferenceServer(mode);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const scenario = await loadScenario(
    "scenarios/queued-export-revocation.yaml",
  );
  scenario.targets.api = {
    type: "http",
    baseUrl: `http://127.0.0.1:${address.port}`,
    headers: {},
  };
  return runScenario(scenario);
}
it("passes when the worker rechecks current authorization", async () => {
  const result = await execute("patched");
  assert.equal(result.passed, true);
  assert.equal(result.events.length, 5);
});
it("detects stale authority and its side effect", async () => {
  const result = await execute("vulnerable");
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.findings.map((finding) => finding.stepId),
    ["run_after_revocation", "confirm_no_effect"],
  );
});
it("finds a single winner when workers race the same queued job", async () => {
  const server = createReferenceServer("patched");
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const result = await runScenario({
    version: 1,
    name: "atomic job claim",
    variables: {},
    actors: {
      alice: { headers: { "x-user": "alice" } },
      worker: { headers: { "x-user": "worker" } },
    },
    targets: {
      api: {
        type: "http",
        baseUrl: `http://127.0.0.1:${address.port}`,
        headers: {},
      },
    },
    steps: [
      {
        kind: "http",
        id: "queue",
        target: "api",
        actor: "alice",
        method: "POST",
        path: "/exports",
        headers: {},
        body: { documentId: "race" },
        save: "job",
        expect: { status: 202 },
      },
      {
        kind: "parallel",
        id: "race",
        count: 20,
        request: {
          target: "api",
          actor: "worker",
          method: "POST",
          path: "/jobs/{{job.body.jobId}}/run",
          headers: {},
          expect: { status: 201 },
        },
        expectSuccesses: 1,
      },
    ],
  });
  assert.equal(result.passed, true, JSON.stringify(result.findings));
});
