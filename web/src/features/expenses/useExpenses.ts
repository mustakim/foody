import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachReceipts, chargeDay, getExpenseForDate, listExpenses, updateDay } from "./expensesApi";
import type { DailyExpense } from "./expensesApi";

export function useExpenses(enabled = true) {
  return useQuery({ enabled, queryFn: listExpenses, queryKey: ["expenses", "all"] });
}

export function useExpenseForDate(expenseDate: string) {
  return useQuery({ queryFn: () => getExpenseForDate(expenseDate), queryKey: ["expenses", expenseDate] });
}

function useDayMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => Promise.all(["expenses", "ledger", "meals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
  });
}

export const useChargeDay = () => useDayMutation(chargeDay);
export const useUpdateDay = () => useDayMutation(updateDay);

export function useAttachReceipts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expense, files }: { expense: DailyExpense; files: File[] }) => attachReceipts(expense, files),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["expenses"] })
  });
}
