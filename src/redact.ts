import type { Json } from "./types.js";
const sensitive =
  /authorization|cookie|token|secret|password|api.?key|credential/iu;
export function redact(value: unknown, depth = 0): Json {
  if (depth > 12) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return typeof value === "string" && value.length > 2048
      ? `${value.slice(0, 2048)}[TRUNCATED]`
      : value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : "[NON_FINITE]";
  if (Array.isArray(value))
    return value.slice(0, 200).map((entry) => redact(entry, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 200)
        .map(([key, entry]) => [
          key,
          sensitive.test(key) ? "[REDACTED]" : redact(entry, depth + 1),
        ]),
    );
  return String(value);
}
