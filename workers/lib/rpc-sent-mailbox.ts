import type { Env } from "../types";
import { DEFAULT_RPC_ALLOWED_FROM } from "./rpc-send-policy";

const RPC_SENDER_MAILBOXES = new Set(
	DEFAULT_RPC_ALLOWED_FROM.map((address) => address.toLowerCase()),
);

function mailboxSettingsKey(mailboxId: string): string {
	return `mailboxes/${mailboxId.trim().toLowerCase()}.json`;
}

/**
 * Choose which mailbox receives the RPC Sent copy.
 * Allowlisted system senders (no-reply@, noreply@) always file on their own
 * mailbox. Other from addresses use their mailbox when provisioned in R2,
 * otherwise DEFAULT_MAILBOX.
 */
export async function resolveRpcSentMailbox(
	env: Env,
	fromEmail: string,
): Promise<string> {
	const from = fromEmail.trim().toLowerCase();
	if (from && RPC_SENDER_MAILBOXES.has(from)) {
		return from;
	}
	if (from && (await env.BUCKET.head(mailboxSettingsKey(from)))) {
		return from;
	}

	const fallback = (env.DEFAULT_MAILBOX || "").trim().toLowerCase();
	return fallback || from;
}
