import { isDeepStrictEqual } from "node:util";
import type { Expectation, Observation } from "./types.js";
function atPath(
  value: unknown,
  path: string,
): { found: boolean; value?: unknown } {
  let current = value;
  for (const part of path.split(".")) {
    if (typeof current !== "object" || current === null || !(part in current))
      return { found: false };
    current = (current as Record<string, unknown>)[part];
  }
  return { found: true, value: current };
}
export function assertObservation(
  observation: Observation,
  expected?: Expectation,
): string | undefined {
  if (!expected) return;
  if (expected.status !== undefined && observation.status !== expected.status)
    return `expected HTTP ${expected.status}, received ${observation.status ?? "no status"}`;
  if (expected.error !== undefined && observation.error !== expected.error)
    return `expected MCP error=${expected.error}, received error=${observation.error ?? false}`;
  if (expected.path) {
    const actual = atPath(observation, expected.path);
    if (expected.absent === true && actual.found)
      return `expected ${expected.path} to be absent`;
    if (expected.absent !== true && !actual.found)
      return `expected ${expected.path} to exist`;
    if (
      "equals" in expected &&
      !isDeepStrictEqual(actual.value, expected.equals)
    )
      return `expected ${expected.path}=${JSON.stringify(expected.equals)}, received ${JSON.stringify(actual.value)}`;
  }
  return;
}
