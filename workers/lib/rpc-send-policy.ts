export const DEFAULT_RPC_ALLOWED_FROM = [
	"noreply@zenithpayments.support",
] as const;

export function normalizeFromEmail(
	from: string | { email: string; name?: string },
): string {
	return (typeof from === "string" ? from : from.email).trim().toLowerCase();
}

export function assertRpcSenderAllowed(
	from: string | { email: string; name?: string },
	allowed: readonly string[],
): void {
	const email = normalizeFromEmail(from);
	const allow = new Set(allowed.map((a) => a.toLowerCase()));
	if (!allow.has(email)) {
		throw new Error(`RPC from address not allowed: ${email}`);
	}
}
