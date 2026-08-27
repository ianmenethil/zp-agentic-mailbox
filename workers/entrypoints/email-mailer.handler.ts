import type {
	EmailMessage,
	EmailRpcResult,
	EmailRpcSendData,
} from "@ianmenethil/zp-emails/send";
import { Folders } from "../../shared/folders";
import { sendEmail } from "../email-sender";
import {
	generateMessageId,
	getMailboxStub,
} from "../lib/email-helpers";
import {
	DEFAULT_RPC_ALLOWED_FROM,
	assertRpcSenderAllowed,
	normalizeFromEmail,
} from "../lib/rpc-send-policy";
import type { Env } from "../types";

function addressListToString(
	value: string | string[] | undefined,
): string | null {
	if (value == null) return null;
	return (Array.isArray(value) ? value.join(", ") : value).toLowerCase();
}

/**
 * Persist an RPC send into Sent so outbound mail is visible in the inbox UI
 * (Resend-dashboard equivalent). Uses DEFAULT_MAILBOX when set — RPC from
 * addresses (noreply@…) are allowlisted separately from UI mailboxes.
 */
async function saveRpcSendToSent(
	env: Env,
	message: EmailMessage,
	fromEmail: string,
	deliveryMessageId: string,
): Promise<void> {
	const mailboxId =
		(env.DEFAULT_MAILBOX || "").trim().toLowerCase() || fromEmail;
	const fromDomain = fromEmail.split("@")[1];
	if (!fromDomain) return;

	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);
	const stub = getMailboxStub(env, mailboxId);
	const toStr = addressListToString(message.to as string | string[]) ?? "";

	await stub.createEmail(
		Folders.SENT,
		{
			id: messageId,
			subject: message.subject,
			sender: fromEmail,
			recipient: toStr,
			cc: addressListToString(message.cc as string | string[] | undefined),
			bcc: addressListToString(message.bcc as string | string[] | undefined),
			date: new Date().toISOString(),
			body: message.html || message.text || "",
			in_reply_to: null,
			email_references: null,
			thread_id: messageId,
			message_id: deliveryMessageId || outgoingMessageId,
		},
		[],
	);
}

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

		const fromEmail = normalizeFromEmail(message.from);
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

		try {
			await saveRpcSendToSent(env, message, fromEmail, result.messageId);
		} catch (e) {
			console.error(
				"RPC send succeeded but Sent copy failed:",
				e instanceof Error ? e.message : e,
			);
		}

		return { ok: true, data: { messageId: result.messageId } };
	} catch (e) {
		const detail = e instanceof Error ? e.message : String(e);
		const status = /not allowed/i.test(detail) ? 403 : 502;
		return { ok: false, status, detail };
	}
}
