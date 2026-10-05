# Security

Only run AuthzTrace against systems you own or are explicitly authorized to test. Scenarios can change state and MCP scenarios can execute local commands.

Treat scenario files as trusted code. The `--allow-command-targets` flag permits commands and arguments from a scenario to execute with the current user's privileges. Review the file and referenced executables first.

Keep credentials in environment variables. Reports redact common credential field names, but redaction cannot identify every application-specific secret. Do not put secrets in URLs, IDs, step names, custom field names, or response values that must remain visible for assertions. Review evidence before sharing it.

Use isolated test tenants, synthetic records, rate limits, and explicit cleanup. Parallel steps can generate up to 100 requests. The runner rejects redirects and applies request deadlines, but a timed-out request may still complete on the target.

This project has not completed an independent security audit. Report suspected vulnerabilities privately to the repository owner with a minimal reproduction and no live credentials.
