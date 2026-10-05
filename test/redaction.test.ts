import assert from "node:assert/strict";
import { it } from "node:test";
import { redact } from "../src/redact.js";
it("redacts nested credential fields", () => {
  const output = redact({
    authorization: "Bearer secret",
    nested: { apiKey: "secret", safe: "visible" },
  });
  assert.deepEqual(output, {
    authorization: "[REDACTED]",
    nested: { apiKey: "[REDACTED]", safe: "visible" },
  });
});
