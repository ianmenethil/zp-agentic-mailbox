# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted AI email client running entirely on Cloudflare Workers. Inbound mail arrives via Cloudflare Email Routing (catch-all → the Worker's `email()` handler in `workers/index.ts`). Each mailbox is an isolated Durable Object with its own SQLite database; attachments live in R2. A React Router v8 SPA (SSR) is served by the same Worker via Hono.

Single-package project — no monorepo, no workspaces (`pnpm-workspace.yaml` only configures pnpm's dependency catalog/overrides, not multi-package workspaces).

Architecture: Browser (React SPA + Agent panel) → Hono Worker (API + SSR, `workers/app.ts`) → `MailboxDO` (SQLite via Drizzle + R2). Hono also routes `/agents/*` → `EmailAgent` DO (AI chat, WebSocket) → Workers AI, and `/mcp` → `EmailMCP` DO (Model Context Protocol server).

## Key commands

- `pnpm dev` — local dev (`react-router dev`); Cloudflare Access auth is skipped in dev (`import.meta.env.DEV` check in `workers/app.ts`).
- `pnpm typecheck` — runs `cf-typegen` (regenerates `worker-configuration.d.ts`) → `react-router typegen` → `tsc -b`. Always regenerates types first; don't hand-edit `worker-configuration.d.ts`.
- `pnpm lint` / `pnpm lint:fix` — ESLint code quality checks and auto-fix.
- `pnpm knip` — finds unused files, dependencies, and exports.
- `pnpm jscpd` — checks for copy/pasted duplicate code across the codebase.
- `pnpm test:rpc` — runs RPC test files via Node's native test runner through `tsx --test` (`rpc-send-policy`, `rpc-sent-mailbox`, `email-mailer`). **Not Vitest** — no Vitest config exists.
- `pnpm check` — the full gate: frozen-lockfile install → `test:rpc` → `typecheck` → `lint` → `knip` → `jscpd` → `build`. This is what `lefthook` runs on pre-push.
- `pnpm build` / `pnpm deploy` (`build && wrangler deploy`) / `pnpm preview`.

## Durable Objects (`workers/`)

- `MailboxDO` (`workers/durableObject/index.ts`) — per-mailbox SQLite storage via Drizzle ORM (`drizzle-orm/durable-sqlite`), migrated via `workers/durableObject/migrations.ts`. Owns email CRUD, threading (`getThreadedEmails` — raw SQL with subject-normalization + window functions), folders, attachments, search, send rate-limiting.
- `EmailAgent extends AIChatAgent` (`workers/agent/index.ts`) — AI chat backend, exposes email tools (`workers/lib/tools.ts`) via Workers AI.
- `EmailMCP extends McpAgent<Env>` (`workers/mcp/index.ts`) — MCP server at `/mcp`, lets external MCP clients (Claude Code, Cursor, etc.) operate on any mailbox by passing `mailboxId`.

## RPC send path (service binding)

Other Workers can send mail via a service binding to `EmailMailerEntrypoint` (`workers/entrypoints/`, exported from `workers/app.ts`), bypassing HTTP/Access entirely. Sender allowlist enforced in `workers/lib/rpc-send-policy.ts` — separate from the UI's `validateSender()` rules. Successful RPC sends are copied into Sent on the from-address mailbox for allowlisted system senders (`no-reply@`, `noreply@`); other senders use their mailbox when provisioned, else `DEFAULT_MAILBOX`.

## Security model — read before touching auth

Cloudflare Access JWT is the **single trust boundary**. Any user passing the Access policy can access **every mailbox**, including via `/mcp` — there is no per-mailbox authorization. This is an intentional design choice per the README, not a bug.

Production fails closed if the `POLICY_AUD` / `TEAM_DOMAIN` secrets aren't set (Access middleware in `workers/app.ts`). Local dev bypasses Access entirely.

## Gotchas

- `tsconfig.cloudflare.json` sets `noImplicitAny: false`, weaker than the root `tsconfig.json`'s `strict: true` — applies to `app/**`, `workers/**`, `shared/**`.
- `@zp-shared/emails` is installed from a private CDN tarball URL (not the npm registry) — `pnpm install --frozen-lockfile` depends on that URL staying up.
- Only three RPC test files exist (`rpc-send-policy.test.ts`, `rpc-sent-mailbox.test.ts`, `email-mailer.entrypoint.test.ts`), all covering the RPC send-policy/Sent-folder feature. `MailboxDO`, `EmailAgent`, `EmailMCP`, and the frontend have no automated tests.
