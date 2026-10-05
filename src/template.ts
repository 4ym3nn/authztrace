import type { Json } from "./types.js";

const pattern = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/gu;
function lookup(root: Record<string, unknown>, path: string): unknown {
  let value: unknown = root;
  for (const part of path.split(".")) {
    if (typeof value !== "object" || value === null || !(part in value))
      throw new Error(`Unknown template value: ${path}`);
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
export function renderString(
  input: string,
  values: Record<string, unknown>,
): string {
  const exact = input.match(/^\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}$/u);
  if (exact) {
    const value = lookup(values, exact[1]!);
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return input.replace(pattern, (_, path: string) => {
    const value = lookup(values, path);
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
export function renderJson(input: Json, values: Record<string, unknown>): Json {
  if (typeof input === "string") {
    const exact = input.match(/^\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}$/u);
    if (exact) return lookup(values, exact[1]!) as Json;
    return renderString(input, values);
  }
  if (Array.isArray(input))
    return input.map((value) => renderJson(value, values));
  if (input && typeof input === "object")
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        renderJson(value, values),
      ]),
    );
  return input;
}
export function resolveEnvironment(
  input: string,
  environment: NodeJS.ProcessEnv,
): string {
  return input.replace(
    /\$\{([A-Z][A-Z0-9_]*)(?::-(.*?))?\}/gu,
    (_, name: string, fallback: string | undefined) =>
      environment[name] ??
      fallback ??
      (() => {
        throw new Error(`Missing environment variable: ${name}`);
      })(),
  );
}
