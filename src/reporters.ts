import type { RunResult } from "./types.js";
const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function toJUnit(result: RunResult): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${xml(result.scenario)}" tests="${result.events.length}" failures="${result.findings.length}" time="${(result.durationMs / 1000).toFixed(3)}">\n${result.events.map((event) => `  <testcase name="${xml(event.stepId)}" time="${((event.observation?.durationMs ?? 0) / 1000).toFixed(3)}">${event.passed ? "" : `<failure message="${xml(event.message)}"/>`}</testcase>`).join("\n")}\n</testsuite>\n`;
}
export function toSarif(result: RunResult): string {
  return (
    JSON.stringify(
      {
        version: "2.1.0",
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [
          {
            tool: {
              driver: {
                name: "AuthzTrace",
                version: "0.1.0",
                rules: [
                  {
                    id: "AUTHZTRACE_EXPECTATION",
                    shortDescription: {
                      text: "Authorization state expectation failed",
                    },
                  },
                ],
              },
            },
            results: result.findings.map((finding) => ({
              ruleId: "AUTHZTRACE_EXPECTATION",
              level: "error",
              message: { text: `${finding.stepId}: ${finding.message}` },
            })),
          },
        ],
      },
      null,
      2,
    ) + "\n"
  );
}
