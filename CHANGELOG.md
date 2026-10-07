# Changelog

Notable changes, newest first. Each entry is dated by its commit.

## 2026-10-08
- Fixed the Sent copy of an RPC send when a recipient is written as `{ email, name }` instead of a plain address: the copy failed (single recipient) or listed `[object object]` (several); it now files the recipient's email address.

## 2026-10-07
- Upgraded the shared email package `@zp-shared/emails` from 0.1.5 to 0.1.6; the package now lives in the `ZP-Packages` repo and is published from there. Entry points and RPC send types are unchanged.

## 2026-09-30
- Upgraded the shared email package `@zp-shared/emails` from 0.1.3 to 0.1.5; the RPC send types the mailer uses are unchanged.

## 2026-09-13
- Inbound mail is now forwarded to a configured address after filing, and the AI agent no longer auto-drafts a reply to every new message by default (`add64d2`).

## 2026-08-28
- Added a lint, type-check, unused-code and duplicate-code gate that runs before every commit and push (`bbc79d5`).
- The default set of mailboxes created on first load no longer lists the no-reply address twice (`9d1dbae`).
- RPC sends are now filed into the sending system's own mailbox (when provisioned) instead of always landing in the shared default mailbox (`0596858`).

## 2026-08-27
- Moved the build and scripts from npm to pnpm and upgraded the main dependencies, including React Router 7 to 8 (`7f54905`, `311078d`).
- Successful RPC email sends are now copied into the Sent folder, so service-sent mail is visible in the Agent Inbox UI (`0ca42ba`).
- Added a configurable default mailbox for inbound mail and a light/dark theme toggle in the UI (`f13c00c`).
- Exposed a private `EmailMailerEntrypoint` service binding so other Workers can send mail directly, restricted to an allowlist of system sender addresses (`18f3670`, `ea0147c`, `c4e1feb`).

## 2026-04-16
- Cloudflare Access setup now accepts a full certificate URL for `TEAM_DOMAIN` and no longer requires `POLICY_AUD`/`TEAM_DOMAIN` to be hardcoded at deploy time (`0d8e52e`).
- Initial release: a self-hosted email client with an AI agent, running on Cloudflare Workers (`cff1a79`).
