# AuthzTrace

AuthzTrace tests authorization as a sequence of state changes instead of a list of isolated requests. It can queue work, revoke access, execute the queued operation, and verify both the decision and resulting state. The same runner supports HTTP APIs, concurrent requests, background-worker endpoints, and MCP tools.

Use it in controlled systems where you have permission to run security tests.

## Why state matters

Many authorization failures require a transition:

```text
access granted -> work queued -> access revoked -> work executed
```

A direct endpoint test can pass while an alternate channel still uses stale authority. AuthzTrace keeps observations from earlier steps, interpolates them into later requests, and produces machine-readable evidence when an invariant fails.

## Quick start

Requires Node.js 22.13 or newer and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm demo
```

The demo runs one scenario against paired reference targets. It reports a vulnerability in the stale-authority implementation and passes the implementation that rechecks current permission.

Run the CLI against the patched HTTP fixture:

```bash
pnpm fixture:patched
pnpm build
node dist/cli.js run scenarios/queued-export-revocation.yaml \
  --json reports/result.json \
  --junit reports/junit.xml \
  --sarif reports/result.sarif
```

Run an MCP scenario:

```bash
pnpm build
node dist/cli.js run scenarios/mcp-revocation.yaml --allow-command-targets
```

MCP targets launch local commands declared by the scenario. AuthzTrace requires an explicit flag because scenario files must be treated as trusted code.

## Scenario format

```yaml
version: 1
name: queued export is denied after requester revocation

actors:
  member:
    headers: { x-user: alice }
  admin:
    headers: { x-user: admin }
  worker:
    headers: { x-user: worker }

targets:
  api:
    type: http
    baseUrl: ${AUTHZTRACE_TARGET:-http://127.0.0.1:4317}

steps:
  - kind: http
    id: queue
    target: api
    actor: member
    method: POST
    path: /exports
    body: { documentId: quarterly-report }
    save: queued
    expect: { status: 202, path: body.jobId }

  - kind: http
    id: revoke
    target: api
    actor: admin
    method: DELETE
    path: /members/alice
    expect: { status: 204 }

  - kind: http
    id: execute
    target: api
    actor: worker
    method: POST
    path: /jobs/{{queued.body.jobId}}/run
    expect: { status: 403 }
```

Values saved by a step expose `status`, `body`, `durationMs`, and the transport result. Templates can reference them with `{{name.body.id}}`. Target URLs, headers, commands, arguments, and MCP environment values can use `${NAME}` or `${NAME:-fallback}`. Missing environment variables fail the run.

Assertions support HTTP status, MCP error state, dotted response paths, exact JSON values, and absence checks. `parallel` steps issue 2 to 100 requests simultaneously and can assert how many satisfied the nested request expectation.

## Evidence and exit codes

The console and JSON reports include one event per state transition. JUnit integrates with test systems, and SARIF exposes failed authorization invariants to code-scanning interfaces.

- Exit 0: every invariant passed.
- Exit 1: invalid scenario or runner failure.
- Exit 2: one or more authorization expectations failed.
- Exit 64: invalid CLI usage.

Response fields with names such as `authorization`, `cookie`, `token`, `secret`, `password`, `apiKey`, or `credential` are redacted before storage. HTTP response bodies are limited to 1 MiB. Response depth, collection size, and strings are bounded. Avoid placing credentials in URLs, scenario files, identifiers, or nonstandard field names.

## Project status

Version 0.1 is an evaluation release. Scenario files are strict and versioned, but the API is pre-1.0. See [the architecture](docs/ARCHITECTURE.md), [security guidance](SECURITY.md), and [contributing guide](CONTRIBUTING.md).
