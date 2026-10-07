import { WorkerEntrypoint } from "cloudflare:workers";
import type {
	EmailMessage,
	EmailRpcContract,
	EmailRpcSendData,
	RpcResult,
} from "@zp-shared/rpc";
import type { Env } from "../types";
import { handleRpcSend } from "./email-mailer.handler";

export class EmailMailerEntrypoint
	extends WorkerEntrypoint<Env>
	implements EmailRpcContract
{
	async send(
		message: EmailMessage,
	): Promise<RpcResult<EmailRpcSendData>> {
		return handleRpcSend(this.env, message);
	}
}
