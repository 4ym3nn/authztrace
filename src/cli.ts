#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadScenario } from "./schema.js";
import { runScenario } from "./runner.js";
import { toJUnit, toSarif } from "./reporters.js";

const args = process.argv.slice(2);
const file = args[0] === "run" ? args[1] : undefined;
if (!file) {
  console.error(
    "Usage: authztrace run <scenario.yaml> [--json path] [--junit path] [--sarif path] [--allow-command-targets]",
  );
  process.exitCode = 64;
} else {
  try {
    const option = (name: string) => {
      const index = args.indexOf(name);
      return index < 0 ? undefined : args[index + 1];
    };
    const result = await runScenario(await loadScenario(resolve(file)), {
      allowCommandTargets: args.includes("--allow-command-targets"),
    });
    for (const event of result.events)
      console.log(
        `${event.passed ? "PASS" : "FAIL"} ${event.stepId}: ${event.message}`,
      );
    for (const [flag, content] of [
      ["--json", JSON.stringify(result, null, 2) + "\n"],
      ["--junit", toJUnit(result)],
      ["--sarif", toSarif(result)],
    ] as const) {
      const output = option(flag);
      if (output) {
        await mkdir(dirname(resolve(output)), { recursive: true });
        await writeFile(resolve(output), content);
      }
    }
    console.log(
      `${result.passed ? "PASS" : "FAIL"}: ${result.scenario} (${result.durationMs.toFixed(1)} ms)`,
    );
    process.exitCode = result.passed ? 0 : 2;
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exitCode = 1;
  }
}
