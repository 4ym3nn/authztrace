import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const mode =
  process.env.AUTHZTRACE_MODE === "vulnerable" ? "vulnerable" : "patched";
let currentAccess = true;
const authorityAtStart = true;
const server = new McpServer({
  name: "authztrace-reference",
  version: "0.1.0",
});
server.registerTool(
  "set_access",
  { inputSchema: { allowed: z.boolean() } },
  async ({ allowed }) => {
    currentAccess = allowed;
    return { content: [{ type: "text", text: JSON.stringify({ allowed }) }] };
  },
);
server.registerTool(
  "export_document",
  { inputSchema: { documentId: z.string() } },
  async ({ documentId }) => {
    const allowed = mode === "vulnerable" ? authorityAtStart : currentAccess;
    if (!allowed)
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "requester_revoked" }),
          },
        ],
      };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ exportId: `export:${documentId}` }),
        },
      ],
    };
  },
);
await server.connect(new StdioServerTransport());
