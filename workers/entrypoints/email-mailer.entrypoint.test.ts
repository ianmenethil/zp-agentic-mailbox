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

function makeEnv(sendImpl: SendEmail["send"]): Env {
	return {
		EMAIL: { send: sendImpl },
	} as Env;
}

describe("handleRpcSend", () => {
	it("allows listed from and returns messageId", async () => {
		let called = false;
		const env = makeEnv(async () => {
			called = true;
			return { messageId: "msg_123" };
		});

		const result = await handleRpcSend(env, baseMessage);

		assert.equal(called, true);
		assert.deepEqual(result, { ok: true, data: { messageId: "msg_123" } });
	});

	it("rejects disallowed from without calling EMAIL", async () => {
		let called = false;
		const env = makeEnv(async () => {
			called = true;
			return { messageId: "msg_123" };
		});

		const result = await handleRpcSend(env, {
			...baseMessage,
			from: "inbox@zenithpayments.support",
		});

		assert.equal(called, false);
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, 403);
			assert.match(result.detail, /not allowed/i);
		}
	});

	it("maps sendEmail failures to 502", async () => {
		const env = makeEnv(async () => {
			throw new Error("delivery failed");
		});

		const result = await handleRpcSend(env, baseMessage);

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, 502);
			assert.equal(result.detail, "delivery failed");
		}
	});
});
