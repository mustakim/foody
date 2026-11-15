import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addCredit, listLedger } from "./ledgerApi";

export function useLedger(userId?: string, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => listLedger(userId),
    queryKey: ["ledger", userId ?? "all"]
  });
}

export function useAddCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addCredit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger"] })
  });
}
