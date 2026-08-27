import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EmailMessage } from "@ianmenethil/zp-emails/send";
import type { Env } from "../types";
import { handleRpcSend } from "./email-mailer.handler";

const baseMessage: EmailMessage = {
	to: "user@example.com",
	from: { email: "noreply@zenithpayments.support", name: "ZP" },
	subject: "Hello",
	html: "<p>Hi</p>",
};

type SentCreateArgs = {
	folder: string;
	email: { sender: string; recipient: string; subject: string; body: string };
};

function makeEnv(
	sendImpl: SendEmail["send"],
	opts: {
		defaultMailbox?: string;
		onCreateEmail?: (args: SentCreateArgs) => void;
		createEmailThrows?: boolean;
	} = {},
): Env {
	const createEmail = async (folder: string, email: SentCreateArgs["email"]) => {
		if (opts.createEmailThrows) throw new Error("DO write failed");
		opts.onCreateEmail?.({ folder, email });
	};

	return {
		EMAIL: { send: sendImpl },
		DEFAULT_MAILBOX: opts.defaultMailbox ?? "inbox@zenithpayments.support",
		MAILBOX: {
			idFromName: (name: string) => ({ name }),
			get: () => ({ createEmail }),
		},
	} as unknown as Env;
}

describe("handleRpcSend", () => {
	it("allows listed from, sends, and saves a Sent copy on DEFAULT_MAILBOX", async () => {
		let called = false;
		const saved: SentCreateArgs[] = [];
		const env = makeEnv(
			async () => {
				called = true;
				return { messageId: "msg_123" };
			},
			{ onCreateEmail: (args) => saved.push(args) },
		);

		const result = await handleRpcSend(env, baseMessage);

		assert.equal(called, true);
		assert.deepEqual(result, { ok: true, data: { messageId: "msg_123" } });
		assert.equal(saved.length, 1);
		assert.equal(saved[0]?.folder, "sent");
		assert.equal(saved[0]?.email.sender, "noreply@zenithpayments.support");
		assert.equal(saved[0]?.email.recipient, "user@example.com");
		assert.equal(saved[0]?.email.subject, "Hello");
		assert.equal(saved[0]?.email.body, "<p>Hi</p>");
	});

	it("rejects disallowed from without calling EMAIL or writing Sent", async () => {
		let called = false;
		let created = false;
		const env = makeEnv(
			async () => {
				called = true;
				return { messageId: "msg_123" };
			},
			{ onCreateEmail: () => { created = true; } },
		);

		const result = await handleRpcSend(env, {
			...baseMessage,
			from: "inbox@zenithpayments.support",
		});

		assert.equal(called, false);
		assert.equal(created, false);
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, 403);
			assert.match(result.detail, /not allowed/i);
		}
	});

	it("maps sendEmail failures to 502 without writing Sent", async () => {
		let created = false;
		const env = makeEnv(
			async () => {
				throw new Error("delivery failed");
			},
			{ onCreateEmail: () => { created = true; } },
		);

		const result = await handleRpcSend(env, baseMessage);

		assert.equal(created, false);
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, 502);
			assert.equal(result.detail, "delivery failed");
		}
	});

	it("still returns ok when Sent copy fails after delivery", async () => {
		const env = makeEnv(
			async () => ({ messageId: "msg_456" }),
			{ createEmailThrows: true },
		);

		const result = await handleRpcSend(env, baseMessage);
		assert.deepEqual(result, { ok: true, data: { messageId: "msg_456" } });
	});
});
