import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Env } from "../types";
import { resolveRpcSentMailbox } from "./rpc-sent-mailbox";

function envWithMailboxes(
	existing: string[],
	defaultMailbox = "inbox@zenithpayments.support",
): Env {
	const keys = new Set(existing.map((id) => id.toLowerCase()));
	return {
		DEFAULT_MAILBOX: defaultMailbox,
		BUCKET: {
			head: async (key: string) =>
				keys.has(key.replace("mailboxes/", "").replace(".json", ""))
					? {}
					: null,
		},
	} as unknown as Env;
}

describe("resolveRpcSentMailbox", () => {
	it("uses the from-address mailbox when it exists", async () => {
		const env = envWithMailboxes([
			"no-reply@zenithpayments.support",
			"inbox@zenithpayments.support",
		]);
		const mailbox = await resolveRpcSentMailbox(
			env,
			"no-reply@zenithpayments.support",
		);
		assert.equal(mailbox, "no-reply@zenithpayments.support");
	});

	it("falls back to DEFAULT_MAILBOX when from mailbox is missing", async () => {
		const env = envWithMailboxes(["inbox@zenithpayments.support"]);
		const mailbox = await resolveRpcSentMailbox(
			env,
			"noreply@zenithpayments.support",
		);
		assert.equal(mailbox, "inbox@zenithpayments.support");
	});

	it("falls back to from address when no default mailbox is configured", async () => {
		const env = envWithMailboxes([], "");
		const mailbox = await resolveRpcSentMailbox(
			env,
			"noreply@zenithpayments.support",
		);
		assert.equal(mailbox, "noreply@zenithpayments.support");
	});
});
