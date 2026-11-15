import { blocksClient } from "../../lib/blocks/client";
import { itemId, normalizeItems, roundMoney } from "../../lib/blocks/items";
import { addCharge } from "../ledger/ledgerApi";
import { listMealEntries, markMealCharged } from "../meals/mealsApi";
import { receiptsOf, uploadReceipt } from "./receiptsApi";

export type DailyExpense = Record<string, unknown> & {
  ItemId?: string;
  ExpenseDate?: string;
  TotalAmount?: number;
  HeadCount?: number;
  PerHeadAmount?: number;
  Note?: string;
  EnteredByName?: string;
  ReceiptFileIds?: string[];
  ReceiptFileNames?: string[];
  CreatedDate?: string;
};

const expenses = blocksClient.data.collection<DailyExpense>("DailyExpense", {
  fields: ["ExpenseDate", "TotalAmount", "HeadCount", "PerHeadAmount", "Note", "EnteredByName", "ReceiptFileIds", "ReceiptFileNames", "CreatedDate"]
});

export async function listExpenses(): Promise<DailyExpense[]> {
  const response = await expenses.list({ pageNo: 1, pageSize: 1000 });
  return normalizeItems<DailyExpense>(response).sort((a, b) => String(b.ExpenseDate ?? "").localeCompare(String(a.ExpenseDate ?? "")));
}

export async function getExpenseForDate(expenseDate: string): Promise<DailyExpense | null> {
  const response = await expenses.list({ filter: { ExpenseDate: expenseDate }, pageNo: 1, pageSize: 10 });
  return normalizeItems<DailyExpense>(response).find((expense) => expense.ExpenseDate === expenseDate) ?? null;
}

// Splits the day's total equally across everyone signed up for that date:
// records the expense, writes one charge per person to the ledger, and marks
// each sign-up as charged so it can no longer be cancelled.
export async function chargeDay(input: { expenseDate: string; totalAmount: number; note: string; enteredByName: string; files: File[] }) {
  if (!(input.totalAmount > 0)) throw new Error("Enter the day's total cost.");
  if (await getExpenseForDate(input.expenseDate)) throw new Error("This day has already been charged.");

  const entries = (await listMealEntries(input.expenseDate)).filter((entry) => !entry.IsCharged);
  if (entries.length === 0) throw new Error("No one is signed up for this day, so there is no one to charge.");

  const perHead = roundMoney(input.totalAmount / entries.length);
  // Upload documents first: if one fails, nobody has been charged yet.
  const receipts = await Promise.all(input.files.map((file) => uploadReceipt(file, input.expenseDate)));
  await expenses.create({
    EnteredByName: input.enteredByName,
    ExpenseDate: input.expenseDate,
    HeadCount: entries.length,
    Note: input.note,
    PerHeadAmount: perHead,
    ReceiptFileIds: receipts.map((receipt) => receipt.fileId),
    ReceiptFileNames: receipts.map((receipt) => receipt.name),
    TotalAmount: roundMoney(input.totalAmount)
  });
  // The create response doesn't reliably carry the new id, so read it back.
  const expense = await getExpenseForDate(input.expenseDate);
  const expenseId = String(expense?.ItemId ?? expense?.itemId ?? "");

  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      await addCharge({
        amount: perHead,
        dailyExpenseId: expenseId,
        enteredByName: input.enteredByName,
        entryDate: input.expenseDate,
        note: input.note || `Meal on ${input.expenseDate}`,
        userId: String(entry.UserId ?? ""),
        userName: String(entry.UserName ?? entry.UserEmail ?? "")
      });
      await markMealCharged(entry, perHead);
    })
  );
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) throw new Error(`Expense saved, but charging failed for ${failed} of ${entries.length} people. Check the ledger before retrying.`);
  return { headCount: entries.length, perHead };
}

// Documents can be added after the day is charged (e.g. a late bill photo).
export async function attachReceipts(expense: DailyExpense, files: File[]) {
  const added = await Promise.all(files.map((file) => uploadReceipt(file, String(expense.ExpenseDate ?? ""))));
  const all = [...receiptsOf(expense), ...added];
  return expenses.update(itemId(expense), {
    ReceiptFileIds: all.map((receipt) => receipt.fileId),
    ReceiptFileNames: all.map((receipt) => receipt.name)
  });
}
