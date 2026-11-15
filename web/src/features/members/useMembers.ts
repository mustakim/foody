import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMembers, promoteToAdmin } from "./membersApi";

export function useMembers() {
  return useQuery({ queryFn: listMembers, queryKey: ["members"] });
}

export function usePromoteToAdmin() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: promoteToAdmin, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }) });
}
