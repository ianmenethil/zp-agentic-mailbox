// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Email sending via Cloudflare Email Service binding.
 *
 * Uses the `send_email` Worker binding (`env.EMAIL.send()`) to send emails.
 *
 * See: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
 */

import type { EmailAddress } from "@zp-shared/rpc";

/**
 * The binding takes a bare address or `{ email, name? }`. Leave `name` off
 * instead of passing `name: undefined`.
 */
function toBindingAddress(
	addr: EmailAddress,
): string | { email: string; name?: string } {
	if (typeof addr === "string") return addr;
	return addr.name === undefined
		? { email: addr.email }
		: { email: addr.email, name: addr.name };
}

function toBindingAddresses(value: EmailAddress | EmailAddress[]) {
	return Array.isArray(value)
		? value.map(toBindingAddress)
		: toBindingAddress(value);
}

export interface SendEmailParams {
	to: EmailAddress | EmailAddress[];
	from: EmailAddress;
	subject: string;
	html?: string;
	text?: string;
	cc?: EmailAddress | EmailAddress[];
	bcc?: EmailAddress | EmailAddress[];
	replyTo?: EmailAddress;
	attachments?: {
		content: string; // base64 encoded
		filename: string;
		type: string;
		disposition: "attachment" | "inline";
		contentId?: string;
	}[];
	headers?: Record<string, string>;
}

/**
 * Send an email using the Cloudflare Email Service binding.
 *
 * @param binding  - The `EMAIL` SendEmail binding from env
 * @param params   - Email parameters (to, from, subject, body, etc.)
 * @returns The send result with messageId
 * @throws On validation or delivery errors (error has `.code` property)
 */
export async function sendEmail(
	binding: SendEmail,
	params: SendEmailParams,
): Promise<{ messageId: string }> {
	const message: Record<string, unknown> = {
		to: toBindingAddresses(params.to),
		from: toBindingAddress(params.from),
		subject: params.subject,
	};

	if (params.html) message.html = params.html;
	if (params.text) message.text = params.text;
	if (params.cc) message.cc = toBindingAddresses(params.cc);
	if (params.bcc) message.bcc = toBindingAddresses(params.bcc);
	if (params.replyTo) message.replyTo = toBindingAddress(params.replyTo);

	if (params.headers && Object.keys(params.headers).length > 0) {
		message.headers = params.headers;
	}

	if (params.attachments && params.attachments.length > 0) {
		message.attachments = params.attachments.map((att) => ({
			content: att.content,
			filename: att.filename,
			type: att.type,
			disposition: att.disposition,
			...(att.contentId ? { contentId: att.contentId } : {}),
		}));
	}

	// The generated binding types require `name` on object addresses; the
	// documented API makes it optional, so the payload is cast through unknown.
	const result = await binding.send(message as unknown as EmailMessageBuilder);
	return { messageId: result.messageId };
}
