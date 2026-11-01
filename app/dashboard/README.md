# Marzban dashboard

Use **Bun 1.4.3**, pinned by `packageManager` and both workflows. Run these commands from `app/dashboard`:

```sh
bun run check:install
bun install --frozen-lockfile
bun run lint
bun run format:check
bun run test
bun --bun run typecheck
VITE_BASE_API=/api/ bun --bun run build --outDir build --assetsDir statics
```

Use `bun run lint:fix` for Oxlint's safe fixes and `bun run format` to format files with Oxfmt. Formatting keeps the existing 120 character line width.

Use `bun run dev` for development. Set `VITE_BASE_API` in a local `.env` when using a separate backend. The release workflow uses `/api/`.

### Browser session security

The dashboard signs in through `/api/admin/session`. The backend stores the session in an `HttpOnly` cookie and uses a separate CSRF token for state-changing requests. WebSocket logs authenticate with the same cookie; session tokens must not be placed in WebSocket URLs. Production cookies are `Secure` by default. For a dashboard and API on different sites, configure `ALLOWED_ORIGINS` with the dashboard origin, `AUTH_COOKIE_SAMESITE=none`, and HTTPS (`AUTH_COOKIE_SECURE=true`); same-origin deployment is preferred. The development Vite server proxies `/api` and WebSocket traffic to the backend so local cookie auth works without cross-origin cookies. `/api/admin/token` remains available for non-browser integrations.

Editor drafts are tab-scoped and short lived. Credential fields such as passwords, UUIDs, tokens, private keys, and secrets are removed before draft persistence; users may need to re-enter those values after a reload.

`bun.lock` is the only dependency lockfile. When deliberately changing dependencies, use `bun add`, `bun remove`, or `bun install`, review both manifest and lockfile, and commit both. Do not regenerate the lockfile as a CI workaround. `--bun` ensures build tools use the Bun runtime rather than a system Node version.

See [installation verification](test/installation/README.md) for fresh-install, cold-cache, workflow, and release-artifact checks. The full headless frontend suite is documented in [test/README.md](test/README.md).
