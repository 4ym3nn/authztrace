import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { assertObservation } from "./assertion.js";
import { redact } from "./redact.js";
import { renderJson, renderString, resolveEnvironment } from "./template.js";
import type {
  HttpStep,
  McpTarget,
  Observation,
  RunOptions,
  RunResult,
  Scenario,
  Target,
  TraceEvent,
} from "./types.js";

export async function runScenario(
  scenario: Scenario,
  options: RunOptions = {},
): Promise<RunResult> {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const environment = options.environment ?? process.env;
  const fetcher = options.fetch ?? fetch;
  const values: Record<string, unknown> = { ...scenario.variables };
  const events: TraceEvent[] = [];
  const clients = new Map<string, Client>();
  const target = (name: string): Target => {
    const found = scenario.targets[name];
    if (!found) throw new Error(`Unknown target: ${name}`);
    return found;
  };
  const readResponse = async (response: Response): Promise<string> => {
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        throw new Error("HTTP response exceeds 1 MiB");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  };
  const runHttp = async (
    step: Omit<HttpStep, "kind" | "id" | "save">,
  ): Promise<Observation> => {
    const selected = target(step.target);
    if (selected.type !== "http")
      throw new Error(`${step.target} is not an HTTP target`);
    const actor = step.actor ? scenario.actors[step.actor] : undefined;
    if (step.actor && !actor) throw new Error(`Unknown actor: ${step.actor}`);
    const context = { ...values };
    const base = resolveEnvironment(selected.baseUrl, environment);
    const path = renderString(step.path, context);
    const headers = Object.fromEntries(
      Object.entries({
        ...selected.headers,
        ...actor?.headers,
        ...step.headers,
      }).map(([key, value]) => [
        key,
        resolveEnvironment(renderString(value, context), environment),
      ]),
    );
    const body =
      step.body === undefined ? undefined : renderJson(step.body, context);
    if (
      body !== undefined &&
      !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
    )
      headers["content-type"] = "application/json";
    const before = performance.now();
    const response = await fetcher(new URL(path, base), {
      method: step.method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const content = await readResponse(response);
    let parsed: unknown = content;
    try {
      parsed = content ? JSON.parse(content) : null;
    } catch {}
    return {
      transport: "http",
      status: response.status,
      body: redact(parsed),
      durationMs: performance.now() - before,
    };
  };
  const mcpClient = async (
    name: string,
    selected: McpTarget,
  ): Promise<Client> => {
    const current = clients.get(name);
    if (current) return current;
    if (!options.allowCommandTargets)
      throw new Error(
        "MCP command targets require allowCommandTargets=true or --allow-command-targets",
      );
    const client = new Client({ name: "authztrace", version: "0.1.0" });
    await client.connect(
      new StdioClientTransport({
        command: resolveEnvironment(selected.command, environment),
        args: selected.args.map((arg) => resolveEnvironment(arg, environment)),
        env: {
          ...getDefaultEnvironment(),
          ...Object.fromEntries(
            Object.entries(selected.env).map(([key, value]) => [
              key,
              resolveEnvironment(value, environment),
            ]),
          ),
        },
        stderr: "ignore",
      }),
    );
    clients.set(name, client);
    return client;
  };
  try {
    for (const step of scenario.steps) {
      try {
        let observation: Observation;
        let message: string | undefined;
        if (step.kind === "http") observation = await runHttp(step);
        else if (step.kind === "mcp") {
          const selected = target(step.target);
          if (selected.type !== "mcp")
            throw new Error(`${step.target} is not an MCP target`);
          const before = performance.now();
          const result = await (
            await mcpClient(step.target, selected)
          ).callTool(
            {
              name: step.tool,
              arguments: renderJson(step.arguments, values) as Record<
                string,
                unknown
              >,
              ...(step.metadata
                ? {
                    _meta: renderJson(step.metadata, values) as Record<
                      string,
                      unknown
                    >,
                  }
                : {}),
            },
            undefined,
            { timeout: 10_000 },
          );
          observation = {
            transport: "mcp",
            error: result.isError === true,
            body: redact(result),
            durationMs: performance.now() - before,
          };
        } else {
          const results = await Promise.all(
            Array.from({ length: step.count }, () => runHttp(step.request)),
          );
          const successes = results.filter(
            (result) => !assertObservation(result, step.request.expect),
          ).length;
          observation = {
            transport: "http",
            body: redact({ successes, results }),
            durationMs: Math.max(...results.map((result) => result.durationMs)),
          };
          if (
            step.expectSuccesses !== undefined &&
            successes !== step.expectSuccesses
          )
            message = `expected ${step.expectSuccesses} successful parallel requests, received ${successes}`;
        }
        message ??=
          step.kind === "parallel"
            ? undefined
            : assertObservation(observation, step.expect);
        if (step.save) values[step.save] = observation;
        events.push({
          sequence: events.length + 1,
          stepId: step.id,
          kind: step.kind,
          passed: !message,
          message: message ?? "expectation satisfied",
          observation,
        });
      } catch (cause) {
        events.push({
          sequence: events.length + 1,
          stepId: step.id,
          kind: step.kind,
          passed: false,
          message: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
  } finally {
    await Promise.allSettled(
      [...clients.values()].map((client) => client.close()),
    );
  }
  return {
    scenario: scenario.name,
    passed: events.every((event) => event.passed),
    startedAt,
    durationMs: performance.now() - started,
    events,
    findings: events.filter((event) => !event.passed),
  };
}
