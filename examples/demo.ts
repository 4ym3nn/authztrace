import { once } from "node:events";
import {
  createReferenceServer,
  type ReferenceMode,
} from "./reference-server.js";
import { loadScenario, runScenario } from "../src/index.js";

const scenario = await loadScenario("scenarios/queued-export-revocation.yaml");
for (const mode of ["vulnerable", "patched"] as ReferenceMode[]) {
  const server = createReferenceServer(mode);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Reference server did not bind");
  const result = await runScenario({
    ...scenario,
    targets: {
      api: {
        type: "http",
        baseUrl: `http://127.0.0.1:${address.port}`,
        headers: {},
      },
    },
  });
  console.log(`${mode}: ${result.passed ? "PASS" : "VULNERABILITY DETECTED"}`);
  for (const finding of result.findings)
    console.log(`  ${finding.stepId}: ${finding.message}`);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
