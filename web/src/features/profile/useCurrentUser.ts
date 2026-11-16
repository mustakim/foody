import { useQuery } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { useAuth } from "../../app/providers/AuthProvider";
import { blocksClient } from "../../lib/blocks/client";

export function useCurrentUser() {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => blocksClient.iam.me(),
    queryKey: ["iam", "me"]
  });
}

export function userDisplayName(profile?: BlocksUser): string {
  if (!profile) return "";
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || profile.email || "";
}

// UI gating only -- hiding admin controls is not access control; the Data
// Gateway's own policies are what actually stop a non-admin write.
export function isAdmin(profile?: BlocksUser): boolean {
  return userRoles(profile).includes("admin");
}

// iam.me returns roles as a list, but the IAM user list returns them per
// organization ({ default: ["admin", "user"] }); accept either shape.
export function userRoles(profile?: BlocksUser): string[] {
  const roles: unknown = profile?.roles;
  if (Array.isArray(roles)) return roles.map(String);
  if (roles && typeof roles === "object") return Object.values(roles).flatMap((list) => (Array.isArray(list) ? list.map(String) : []));
  return [];
}

export function userInitials(profile?: BlocksUser): string {
  if (!profile) return "?";
  const first = profile.firstName?.[0];
  const last = profile.lastName?.[0];
  if (first || last) return `${first ?? ""}${last ?? ""}`.toUpperCase();
  return (profile.email?.[0] ?? "?").toUpperCase();
}
