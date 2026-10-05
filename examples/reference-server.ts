import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";

export type ReferenceMode = "vulnerable" | "patched";
export function createReferenceServer(mode: ReferenceMode): Server {
  let members = new Set(["alice"]);
  const jobs = new Map<
    string,
    { requestedBy: string; documentId: string; state: "queued" | "completed" }
  >();
  return createServer(async (request, response) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const user = String(request.headers["x-user"] ?? "anonymous");
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      return chunks.length
        ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
            string,
            unknown
          >)
        : {};
    };
    if (request.method === "POST" && url.pathname === "/reset") {
      members = new Set(["alice"]);
      jobs.clear();
      return send(200, { reset: true });
    }
    if (request.method === "POST" && url.pathname === "/exports") {
      if (!members.has(user)) return send(403, { error: "forbidden" });
      const input = await body();
      const id = randomUUID();
      jobs.set(id, {
        requestedBy: user,
        documentId: String(input.documentId),
        state: "queued",
      });
      return send(202, { jobId: id });
    }
    if (request.method === "DELETE" && url.pathname === "/members/alice") {
      if (user !== "admin") return send(403, { error: "forbidden" });
      members.delete("alice");
      return send(204, null);
    }
    const run = url.pathname.match(/^\/jobs\/([^/]+)\/run$/u);
    if (request.method === "POST" && run) {
      if (user !== "worker") return send(403, { error: "forbidden" });
      const job = jobs.get(run[1]!);
      if (!job) return send(404, { error: "not_found" });
      if (job.state !== "queued")
        return send(409, { error: "already_executed" });
      if (mode === "patched" && !members.has(job.requestedBy))
        return send(403, { error: "requester_revoked" });
      job.state = "completed";
      return send(201, {
        exportId: `export:${job.documentId}`,
        requestedBy: job.requestedBy,
      });
    }
    const inspect = url.pathname.match(/^\/jobs\/([^/]+)$/u);
    if (request.method === "GET" && inspect) {
      const job = jobs.get(inspect[1]!);
      return job ? send(200, job) : send(404, { error: "not_found" });
    }
    return send(404, { error: "not_found" });
  });
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const mode =
    process.env.AUTHZTRACE_MODE === "patched" ? "patched" : "vulnerable";
  const port = Number(process.env.PORT ?? 4317);
  createReferenceServer(mode).listen(port, "127.0.0.1", () =>
    console.log(
      `reference ${mode} target listening on http://127.0.0.1:${port}`,
    ),
  );
}
