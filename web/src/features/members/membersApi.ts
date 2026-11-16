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
