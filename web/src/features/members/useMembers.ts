import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inviteMember, listMembers, promoteToAdmin } from "./membersApi";

export function useMembers() {
  return useQuery({ queryFn: listMembers, queryKey: ["members"] });
}

export function usePromoteToAdmin() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: promoteToAdmin, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }) });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: inviteMember, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }) });
}
