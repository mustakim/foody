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
  const response = await blocksClient.auth.resendActivation({ email: member.email, userId: member.itemId });
  if (response && response.isSuccess === false) {
    const errors = response.errors && typeof response.errors === "object" ? Object.values(response.errors).join(" ") : "";
    throw new Error(errors || String(response.message ?? "") || "Blocks could not resend the invitation.");
  }
  return response;
}
