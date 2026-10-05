import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { z } from "zod";
import type { Scenario } from "./types.js";

const json: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(json),
    z.record(z.string(), json),
  ]),
);
const expectation = z
  .object({
    status: z.number().int().min(100).max(599).optional(),
    error: z.boolean().optional(),
    path: z.string().min(1).optional(),
    equals: json.optional(),
    absent: z.boolean().optional(),
  })
  .strict();
const request = z
  .object({
    target: z.string().min(1),
    actor: z.string().min(1).optional(),
    method: z.string().regex(/^[A-Z]+$/),
    path: z.string().min(1),
    headers: z.record(z.string(), z.string()).default({}),
    body: json.optional(),
    expect: expectation.optional(),
  })
  .strict();
const http = request
  .extend({
    kind: z.literal("http"),
    id: z.string().min(1),
    save: z.string().min(1).optional(),
  })
  .strict();
const mcp = z
  .object({
    kind: z.literal("mcp"),
    id: z.string().min(1),
    target: z.string().min(1),
    tool: z.string().min(1),
    arguments: json.default({}),
    metadata: z.record(z.string(), json).optional(),
    save: z.string().min(1).optional(),
    expect: expectation.optional(),
  })
  .strict();
const parallel = z
  .object({
    kind: z.literal("parallel"),
    id: z.string().min(1),
    count: z.number().int().min(2).max(100),
    request,
    expectSuccesses: z.number().int().min(0).max(100).optional(),
    save: z.string().min(1).optional(),
  })
  .strict();
const scenario = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    variables: z.record(z.string(), json).default({}),
    actors: z
      .record(
        z.string(),
        z
          .object({ headers: z.record(z.string(), z.string()).default({}) })
          .strict(),
      )
      .default({}),
    targets: z.record(
      z.string(),
      z.discriminatedUnion("type", [
        z
          .object({
            type: z.literal("http"),
            baseUrl: z.string().min(1),
            headers: z.record(z.string(), z.string()).default({}),
          })
          .strict(),
        z
          .object({
            type: z.literal("mcp"),
            command: z.string().min(1),
            args: z.array(z.string()).default([]),
            env: z.record(z.string(), z.string()).default({}),
          })
          .strict(),
      ]),
    ),
    steps: z
      .array(z.discriminatedUnion("kind", [http, mcp, parallel]))
      .min(1)
      .max(500),
  })
  .strict();

export function parseScenario(source: string): Scenario {
  if (Buffer.byteLength(source) > 262_144)
    throw new Error("Scenario exceeds 256 KiB");
  return scenario.parse(YAML.parse(source, { maxAliasCount: 50 })) as Scenario;
}
export async function loadScenario(path: string): Promise<Scenario> {
  return parseScenario(await readFile(path, "utf8"));
}
