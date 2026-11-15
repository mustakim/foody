import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";

export async function listMembers(): Promise<BlocksUser[]> {
  const response = await blocksClient.iam.users.list({ pageNo: 1, pageSize: 500 });
  return response.data ?? [];
}

// updateAccess replaces the user's role list, so send the full set they
// should end up with -- keeping "user" alongside the new "admin".
export function promoteToAdmin(member: BlocksUser) {
  if (!member.itemId) throw new Error("User id is missing.");
  const roles = Array.from(new Set([...(member.roles ?? []), "user", "admin"]));
  return blocksClient.iam.users.updateAccess({ roles, userId: member.itemId });
}
