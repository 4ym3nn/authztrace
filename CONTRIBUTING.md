# Contributing

Use Node.js 22 or 24 and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm demo
```

Changes to scenario semantics require schema and runner tests. Transport changes require an integration test with a real target process. Security findings should include an authoritative post-state assertion instead of relying only on an unexpected status code.

Keep all fixtures synthetic. Do not commit access tokens, cookies, customer data, or evidence from private programs.
