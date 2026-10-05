import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
mkdirSync(join(root, "reports"), { recursive: true });
execFileSync("pnpm", ["pack", "--pack-destination", "reports"], {
  cwd: root,
  stdio: "pipe",
});
const archive = join(
  root,
  "reports",
  `${manifest.name}-${manifest.version}.tgz`,
);
const entries = execFileSync("tar", ["-tzf", archive], {
  encoding: "utf8",
})
  .trim()
  .split("\n");
for (const required of [
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/cli.js",
  "package/docs/ARCHITECTURE.md",
  "package/scenarios/queued-export-revocation.yaml",
])
  assert.ok(entries.includes(required), `missing ${required}`);
assert.equal(
  entries.some((entry) =>
    /(?:test|examples|node_modules|\.env)\//u.test(entry),
  ),
  false,
);
const consumer = mkdtempSync(join(tmpdir(), "authztrace-consumer-"));
execFileSync(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    archive,
  ],
  { cwd: consumer, stdio: "pipe" },
);
const output = execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    "import { parseScenario } from 'authztrace'; const s=parseScenario('version: 1\\nname: installed\\ntargets:\\n  api: {type: http, baseUrl: http://localhost}\\nsteps:\\n  - {kind: http, id: read, target: api, method: GET, path: /}'); console.log(s.name)",
  ],
  { cwd: consumer, encoding: "utf8" },
).trim();
assert.equal(output, "installed");
console.log(`PASS: installed ${archive} in an isolated consumer`);
