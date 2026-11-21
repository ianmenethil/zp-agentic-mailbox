import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequestIdMiddleware } from "@zp-shared/hono-app/request-id";
import { Hono } from "hono";

const HEADER = "x-zp-request-id";

function buildApp() {
	const app = new Hono<{ Variables: { requestId: string } }>();
	app.use("*", createRequestIdMiddleware());
	app.get("/", (c) => c.text(c.var.requestId));
	app.get("/rejected", (c) => c.text("no", 403));
	return app;
}

describe("request id middleware", () => {
	it("reuses a valid inbound id on the response and in c.var.requestId", async () => {
		const res = await buildApp().request("/", { headers: { [HEADER]: "abc-123_DEF=" } });
		assert.equal(res.headers.get(HEADER), "abc-123_DEF=");
		assert.equal(await res.text(), "abc-123_DEF=");
	});

	it("generates an id when the request carries none", async () => {
		const res = await buildApp().request("/");
		const id = res.headers.get(HEADER);
		assert.ok(id && id.length > 0);
		assert.equal(await res.text(), id);
	});

	it("replaces an unusable inbound id", async () => {
		const res = await buildApp().request("/", { headers: { [HEADER]: "not valid!" } });
		const id = res.headers.get(HEADER);
		assert.ok(id && id !== "not valid!");
	});

	it("writes the id on a rejected response too", async () => {
		const res = await buildApp().request("/rejected");
		assert.equal(res.status, 403);
		assert.ok(res.headers.get(HEADER));
	});
});
