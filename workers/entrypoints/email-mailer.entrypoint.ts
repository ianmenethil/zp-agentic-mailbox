import { WorkerEntrypoint } from "cloudflare:workers";
import type {
	EmailMessage,
	EmailRpcContract,
	EmailRpcResult,
	EmailRpcSendData,
} from "@ianmenethil/zp-emails/send";
import type { Env } from "../types";
import { handleRpcSend } from "./email-mailer.handler";

export { handleRpcSend } from "./email-mailer.handler";

export class EmailMailerEntrypoint
	extends WorkerEntrypoint<Env>
	implements EmailRpcContract
{
	async send(
		message: EmailMessage,
	): Promise<EmailRpcResult<EmailRpcSendData>> {
		return handleRpcSend(this.env, message);
	}
}
