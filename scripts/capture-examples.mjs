import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "docs/images");
const working = join(root, "reports/screenshots");
mkdirSync(output, { recursive: true });
mkdirSync(working, { recursive: true });

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 45_000,
    env: { ...process.env, NODE: process.execPath, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const demo = run("pnpm", ["--silent", "demo"]);
assert.match(demo, /vulnerable: VULNERABILITY DETECTED/u);
assert.match(demo, /patched: PASS/u);
const mcpArgs = [
  "dist/cli.js",
  "run",
  "scenarios/mcp-revocation.yaml",
  "--allow-command-targets",
];
const mcp = run(process.execPath, mcpArgs);
assert.match(mcp, /PASS revoke_access/u);
assert.match(mcp, /PASS execute_after_revocation/u);

const captures = [
  {
    name: "revocation-demo",
    title: "Permission revoked. What happens next?",
    subtitle:
      "The same scenario against vulnerable and patched background workers.",
    command: "pnpm --silent demo",
    transcript: demo,
  },
  {
    name: "mcp-revocation",
    title: "Verify authorization at the tool boundary.",
    subtitle:
      "Revoke access, then call a protected tool in a real MCP subprocess.",
    command: `node ${mcpArgs.join(" ")}`,
    transcript: mcp,
  },
];

const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

for (const capture of captures) {
  const lines = capture.transcript
    .split("\n")
    .map((line) => {
      const tone = /VULNERABILITY DETECTED|expected HTTP|expected body/u.test(
        line,
      )
        ? "failure"
        : /PASS/u.test(line)
          ? "success"
          : "muted";
      return `<span class="${tone}">${escape(line) || " "}</span>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>AuthzTrace example output</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 40px 48px; width: 1320px; height: 530px; background: #0b111b; color: #e6edf7; font-family: Arial, sans-serif; }
.brand { color: #70dfc1; font-size: 15px; font-weight: 700; letter-spacing: 2px; }
h1 { margin: 18px 0 10px; font-size: 34px; letter-spacing: -0.6px; }
.subtitle { margin: 0 0 28px; color: #b1bfd2; font-size: 18px; }
.terminal { border: 1px solid #2b3a4e; border-radius: 12px; overflow: hidden; background: #111b2a; }
.bar { border-bottom: 1px solid #2b3a4e; padding: 13px 24px; color: #a9b8ce; font-size: 13px; letter-spacing: 0.8px; }
.content { padding: 22px 26px; }
.command, pre { font-family: "JetBrainsMono Nerd Font", "DejaVu Sans Mono", monospace; font-size: 20px; line-height: 32px; }
.command { color: #e6edf7; white-space: pre-wrap; }
.prompt { color: #70dfc1; }
pre { margin: 18px 0 0; white-space: pre-wrap; }
.success { color: #70dfc1; }
.failure { color: #ffb59e; }
.muted { color: #a9b8ce; }
footer { margin-top: 18px; color: #8c9db6; font-size: 13px; }
</style>
<div class="brand">AUTHZTRACE / RUNNING EXAMPLES</div>
<h1>${escape(capture.title)}</h1>
<p class="subtitle">${escape(capture.subtitle)}</p>
<div class="terminal"><div class="bar">CLI OUTPUT</div><div class="content">
<div class="command"><span class="prompt">$ </span>${escape(capture.command)}</div>
<pre>${lines}</pre>
</div></div>
<footer>Actual local execution output, rendered for readability. Synthetic reference targets.</footer>
</html>`;
  const page = join(working, `${capture.name}.html`);
  writeFileSync(page, html);
  writeFileSync(
    join(working, `${capture.name}.txt`),
    `${capture.command}\n\n${capture.transcript}\n`,
  );
  const profile = mkdtempSync(join(tmpdir(), "authztrace-capture-"));
  const screenshot = join(output, `${capture.name}.png`);
  try {
    run(process.env.CHROMIUM ?? "chromium", [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--window-size=1320,530",
      "--force-device-scale-factor=1",
      "--virtual-time-budget=1000",
      `--screenshot=${screenshot}`,
      pathToFileURL(page).href,
    ]);
    assert.equal(readFileSync(screenshot).subarray(1, 4).toString(), "PNG");
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(`Captured docs/images/${capture.name}.png`);
  console.log(capture.transcript);
}
