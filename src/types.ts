export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Actor {
  headers: Record<string, string>;
}
export interface HttpTarget {
  type: "http";
  baseUrl: string;
  headers: Record<string, string>;
}
export interface McpTarget {
  type: "mcp";
  command: string;
  args: string[];
  env: Record<string, string>;
}
export type Target = HttpTarget | McpTarget;
export interface Expectation {
  status?: number;
  error?: boolean;
  path?: string;
  equals?: Json;
  absent?: boolean;
}
export interface HttpStep {
  kind: "http";
  id: string;
  target: string;
  actor?: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Json;
  save?: string;
  expect?: Expectation;
}
export interface McpStep {
  kind: "mcp";
  id: string;
  target: string;
  tool: string;
  arguments: Json;
  metadata?: Record<string, Json>;
  save?: string;
  expect?: Expectation;
}
export interface ParallelStep {
  kind: "parallel";
  id: string;
  count: number;
  request: Omit<HttpStep, "id" | "kind" | "save">;
  expectSuccesses?: number;
  save?: string;
}
export type Step = HttpStep | McpStep | ParallelStep;
export interface Scenario {
  version: 1;
  name: string;
  description?: string;
  variables: Record<string, Json>;
  actors: Record<string, Actor>;
  targets: Record<string, Target>;
  steps: Step[];
}
export interface Observation {
  transport: "http" | "mcp";
  status?: number;
  error?: boolean;
  body: Json;
  durationMs: number;
}
export interface TraceEvent {
  sequence: number;
  stepId: string;
  kind: Step["kind"];
  passed: boolean;
  message: string;
  observation?: Observation;
}
export interface RunResult {
  scenario: string;
  passed: boolean;
  startedAt: string;
  durationMs: number;
  events: TraceEvent[];
  findings: TraceEvent[];
}
export interface RunOptions {
  environment?: NodeJS.ProcessEnv;
  allowCommandTargets?: boolean;
  fetch?: typeof globalThis.fetch;
}
