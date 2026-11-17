import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { userRoles } from "../profile/useCurrentUser";

export async function listMembers(): Promise<BlocksUser[]> {
  const response = await blocksClient.iam.users.list({ pageNo: 1, pageSize: 500 });
  return response.data ?? [];
}

// updateAccess replaces the user's role list, so send the full set they
// should end up with -- keeping "user" alongside the new "admin".
export function promoteToAdmin(member: BlocksUser) {
  if (!member.itemId) throw new Error("User id is missing.");
  const roles = Array.from(new Set([...userRoles(member), "user", "admin"]));
  // Roles are kept per organization; target the one the user's roles live in.
  const memberRoles: unknown = member.roles;
  const organizationId = memberRoles && !Array.isArray(memberRoles) && typeof memberRoles === "object" ? Object.keys(memberRoles)[0] : undefined;
  return blocksClient.iam.users.updateAccess({ roles, userId: member.itemId, ...(organizationId ? { organizationId } : {}) });
}

// Creates the account with the "user" role; Blocks emails the person an
// activation link to set their password.
export async function inviteMember(input: { email: string; firstName: string; lastName: string }) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  const response = await blocksClient.iam.users.create({
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    roles: ["user"],
    userName: email
  });
  if (response && response.isSuccess === false) {
    throw new Error(Object.values(response.errors ?? {}).join(" ") || "Blocks could not create this account.");
  }
  return response;
}

// Invited but never activated: IAM keeps these as PendingVerification until
// the person opens the emailed link and sets a password.
export function isPendingActivation(member: BlocksUser): boolean {
  return member.accountState === "PendingVerification" || (member.isVerified === false && member.active === false);
}

// Sends a fresh activation email when the first link has expired.
export async function resendInvitation(member: BlocksUser) {
  if (!member.itemId || !member.email) throw new Error("This member has no id or email.");
  if (!isPendingActivation(member)) throw new Error("This member has already activated their account.");
  const response: unknown = await blocksClient.auth.resendActivation({ email: member.email, userId: member.itemId });
  // The SDK's auth calls return the body even for HTTP errors, so only an
  // explicit isSuccess: true counts as sent; anything else is IAM's refusal.
  if ((response as { isSuccess?: unknown } | null)?.isSuccess !== true) {
    throw new Error(iamErrorText(response) || "Blocks did not confirm the invitation was sent.");
  }
  return response;
}

// Flattens IAM's error shapes ({errors: {Field: [..]}}, {title}, {message},
// or plain text) into one readable line.
export function iamErrorText(response: unknown): string {
  if (!response) return "";
  if (typeof response === "string") return response.slice(0, 300);
  const body = response as { errors?: unknown; message?: unknown; title?: unknown; detail?: unknown };
  const parts: string[] = [];
  const collect = (value: unknown, field?: string) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) value.forEach((item) => collect(item, field));
    else if (typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([key, item]) => collect(item, key));
    else parts.push(field && !/^\d+$/.test(field) ? `${field}: ${String(value)}` : String(value));
  };
  collect(body.errors);
  for (const value of [body.title, body.detail, body.message]) if (typeof value === "string" && value) parts.push(value);
  return parts.length ? Array.from(new Set(parts)).join(" · ") : JSON.stringify(response).slice(0, 300);
}
