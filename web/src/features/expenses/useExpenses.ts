import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachReceipts, chargeDay, getExpenseForDate, listExpenses } from "./expensesApi";
import type { DailyExpense } from "./expensesApi";

export function useExpenses(enabled = true) {
  return useQuery({ enabled, queryFn: listExpenses, queryKey: ["expenses", "all"] });
}

export function useExpenseForDate(expenseDate: string) {
  return useQuery({ queryFn: () => getExpenseForDate(expenseDate), queryKey: ["expenses", expenseDate] });
}

export function useChargeDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chargeDay,
    onSettled: () => Promise.all(["expenses", "ledger", "meals"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
  });
}

export function useAttachReceipts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expense, files }: { expense: DailyExpense; files: File[] }) => attachReceipts(expense, files),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["expenses"] })
  });
}
