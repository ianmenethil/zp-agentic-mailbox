import type {
	EmailMessage,
	EmailRpcResult,
	EmailRpcSendData,
} from "@ianmenethil/zp-emails/send";
import { sendEmail } from "../email-sender";
import {
	DEFAULT_RPC_ALLOWED_FROM,
	assertRpcSenderAllowed,
} from "../lib/rpc-send-policy";
import type { Env } from "../types";

export async function handleRpcSend(
	env: Env,
	message: EmailMessage,
	allowedFrom: readonly string[] = DEFAULT_RPC_ALLOWED_FROM,
): Promise<EmailRpcResult<EmailRpcSendData>> {
	try {
		assertRpcSenderAllowed(message.from, allowedFrom);
		if (!message.subject?.trim()) {
			return { ok: false, status: 400, detail: "subject is required" };
		}
		if (!message.html && !message.text) {
			return {
				ok: false,
				status: 400,
				detail: "html and/or text is required",
			};
		}
		const result = await sendEmail(env.EMAIL, {
			to: message.to as string | string[],
			from: message.from as string | { email: string; name: string },
			subject: message.subject,
			html: message.html,
			text: message.text,
			cc: message.cc as string | string[] | undefined,
			bcc: message.bcc as string | string[] | undefined,
			replyTo: message.replyTo as
				| string
				| { email: string; name: string }
				| undefined,
			headers: message.headers,
		});
		return { ok: true, data: { messageId: result.messageId } };
	} catch (e) {
		const detail = e instanceof Error ? e.message : String(e);
		const status = /not allowed/i.test(detail) ? 403 : 502;
		return { ok: false, status, detail };
	}
}
