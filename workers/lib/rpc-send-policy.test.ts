import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertRpcSenderAllowed,
	normalizeFromEmail,
} from "./rpc-send-policy";

describe("rpc-send-policy", () => {
	it("normalizes object and string from addresses", () => {
		assert.equal(normalizeFromEmail("A@Example.com"), "a@example.com");
		assert.equal(
			normalizeFromEmail({ email: "A@Example.com", name: "ZP" }),
			"a@example.com",
		);
	});

	it("allows listed senders", () => {
		for (const address of [
			"noreply@zenithpayments.support",
			"no-reply@zenithpayments.support",
		]) {
			assert.doesNotThrow(() =>
				assertRpcSenderAllowed(address, [
					"noreply@zenithpayments.support",
					"no-reply@zenithpayments.support",
				]),
			);
		}
	});

	it("rejects mailbox-style unlisted senders", () => {
		assert.throws(
			() =>
				assertRpcSenderAllowed("inbox@zenithpayments.support", [
					"noreply@zenithpayments.support",
				]),
			/not allowed/i,
		);
	});
});
