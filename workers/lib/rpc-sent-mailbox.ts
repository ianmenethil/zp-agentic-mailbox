import type { Env } from "../types";

function mailboxSettingsKey(mailboxId: string): string {
	return `mailboxes/${mailboxId.trim().toLowerCase()}.json`;
}

/**
 * Choose which mailbox receives the RPC Sent copy.
 * Prefer the from-address mailbox when it exists; otherwise DEFAULT_MAILBOX.
 */
export async function resolveRpcSentMailbox(
	env: Env,
	fromEmail: string,
): Promise<string> {
	const from = fromEmail.trim().toLowerCase();
	if (from && (await env.BUCKET.head(mailboxSettingsKey(from)))) {
		return from;
	}

	const fallback = (env.DEFAULT_MAILBOX || "").trim().toLowerCase();
	return fallback || from;
}
