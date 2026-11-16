import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addAdjustment, addCredit, deleteLedgerEntry, listLedger } from "./ledgerApi";

export function useLedger(userId?: string, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => listLedger(userId),
    queryKey: ["ledger", userId ?? "all"]
  });
}

function useLedgerMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ledger"] })
  });
}

export const useAddCredit = () => useLedgerMutation(addCredit);
export const useAddAdjustment = () => useLedgerMutation(addAdjustment);
export const useDeleteLedgerEntry = () => useLedgerMutation(deleteLedgerEntry);
