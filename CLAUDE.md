# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Related docs: [README.md](README.md) (setup, features, RPC send guide), [CHANGELOG.md](CHANGELOG.md) (notable changes).

## What this is

Self-hosted AI email client running entirely on Cloudflare Workers. Inbound mail arrives via Cloudflare Email Routing (catch-all → the Worker's `email()` handler in `workers/app.ts`, which calls `receiveEmail` in `workers/index.ts`). After filing, `receiveEmail` forwards the message to `FORWARD_TO` when that var is set, and triggers the agent's auto-draft only when `AUTO_DRAFT` is `"true"` (both in `wrangler.jsonc`; auto-draft is off by default). Each mailbox is an isolated Durable Object with its own SQLite database; attachments live in R2. A React Router v8 SPA (SSR) is served by the same Worker via Hono.

Single-package project — no monorepo, no workspaces (`pnpm-workspace.yaml` only configures pnpm's dependency catalog/overrides, not multi-package workspaces).

Architecture: Browser (React SPA + Agent panel) → Hono Worker (API + SSR, `workers/app.ts`) → `MailboxDO` (SQLite via Drizzle + R2). Hono also routes `/agents/*` → `EmailAgent` DO (AI chat, WebSocket) → Workers AI, and `/mcp` → `EmailMCP` DO (Model Context Protocol server).

## Key commands

- `pnpm dev` — local dev (`react-router dev`); Cloudflare Access auth is skipped in dev (`import.meta.env.DEV` check in `workers/app.ts`).
- `pnpm typecheck` — runs `cf-typegen` (regenerates `worker-configuration.d.ts`) → `react-router typegen` → `tsc -b`. Always regenerates types first; don't hand-edit `worker-configuration.d.ts`. `cf-typegen` passes `--strict-vars=false` so every `vars` entry types as `string`; without it each var types as the literal value in `wrangler.jsonc`, which makes comparing a var against any other value a no-overlap error.
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

## Logging

All logging goes through `@zp-shared/logger` (core entry: `appLogger`, `errorFields`); never `console.*` and never a direct `loglayer`, `pino`, `winston`, `consola` or `@sentry/*` import. `workers/app.ts` calls `configureAppLogger("info", { consoleSeverity: true })` once, then registers `createRequestIdMiddleware()` (`@zp-shared/hono-app/request-id`) and after it `createRequestLoggerMiddleware({ bodies: "none" })` first on the Hono app; the logger writes one `http_request` entry per request. Every request has an id: a valid inbound `x-zp-request-id` is reused, otherwise one is generated. It is the entry's `trace_id` and the `x-zp-request-id` header of every response, rejected requests included. The id middleware stays ahead of the logger so the logger can read it. Everything else is `appLogger.<level>("snake_case_event", { fields })`: the event name says what happened and details go in fields. Levels: a normal event is `info`, a problem the code recovers from is `warn`, a failure is `error`. Put `...errorFields(e)` in a failure's fields. Never log a mail address, subject or body: a mailbox id is an address, so use message ids and counts.

`observability.logs.invocation_logs` is `false` in `wrangler.jsonc`: Cloudflare's own per-call lines (`MailboxDO.jsrpc`, `EmailMailerEntrypoint.jsrpc`, one per inbound mail) are not events, so the Worker writes `email_received`, `rpc_email_sent` and the failure events itself.

## Security model — read before touching auth

Cloudflare Access JWT is the **single trust boundary**. Any user passing the Access policy can access **every mailbox**, including via `/mcp` — there is no per-mailbox authorization. This is an intentional design choice per the README, not a bug.

Production fails closed if the `POLICY_AUD` / `TEAM_DOMAIN` secrets aren't set (Access middleware in `workers/app.ts`). Local dev bypasses Access entirely.

## Gotchas

- `tsconfig.cloudflare.json` sets `noImplicitAny: false`, weaker than the root `tsconfig.json`'s `strict: true` — applies to `app/**`, `workers/**`, `shared/**`.
- `@zp-shared/rpc` is installed from a private CDN tarball URL (not the npm registry) — `pnpm install --frozen-lockfile` depends on that URL staying up. The mailer contract (`EmailRpcContract`, `EmailMessage`, `EmailAddress`, `RpcResult`) lives in `@zp-shared/rpc`. This repo no longer depends on `@zp-shared/emails`; its callers (Auth-Server, API-Server, Status-Server) use `@zp-shared/emails/send` to send to this mailer.
- Only three RPC test files exist (`rpc-send-policy.test.ts`, `rpc-sent-mailbox.test.ts`, `email-mailer.entrypoint.test.ts`), all covering the RPC send-policy/Sent-folder feature. `MailboxDO`, `EmailAgent`, `EmailMCP`, and the frontend have no automated tests.
