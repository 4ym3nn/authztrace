# Architecture

AuthzTrace separates scenario parsing, transport execution, assertions, evidence handling, and reporting.

```text
strict YAML schema
        |
        v
state-machine runner -> HTTP target
        |            -> concurrent HTTP requests
        |            -> trusted local MCP process
        v
redacted observations -> assertions -> console, JSON, JUnit, SARIF
```

## Execution model

Steps run in declaration order. A saved observation becomes available to later templates. A failed expectation is recorded as a finding and does not stop later steps, allowing side-effect checks to run after an authorization bypass. Configuration or transport exceptions are also recorded per step.

Parallel requests begin in the same event-loop turn. This creates useful replay and atomicity pressure, but it does not guarantee synchronized arrival at a remote service. Deployment-specific race testing may require a server-side barrier or transport proxy.

HTTP requests reject redirects, use a ten-second deadline, and parse JSON when possible. MCP clients are reused for all steps targeting the same process so state transitions remain observable. Command targets are disabled unless the caller opts in.

## Security model

Scenarios and command targets are trusted input. Remote responses are untrusted. Scenario validation rejects unknown fields and bounds step counts and concurrency. Reports receive a redacted, size-bounded copy of response data.

AuthzTrace observes externally visible behavior. It cannot prove the absence of side effects that are not represented by an assertion. A complete scenario needs an authoritative post-state check, independent negative controls, and unique controlled markers.

The framework does not infer severity or exploitability. A failed invariant is evidence that requires review in the target's documented authorization model.
