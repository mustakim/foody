import { blocksClient } from "../../lib/blocks/client";
import { itemId, listAllItems, normalizeItems, roundMoney } from "../../lib/blocks/items";
import { addCharge } from "../ledger/ledgerApi";
import { addChargedMeal, markMealCharged, removeMealEntry } from "../meals/mealsApi";
import type { MealEntry } from "../meals/mealsApi";
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
  return (await listAllItems<DailyExpense>(expenses)).sort((a, b) => String(b.ExpenseDate ?? "").localeCompare(String(a.ExpenseDate ?? "")));
}

export async function getExpenseForDate(expenseDate: string): Promise<DailyExpense | null> {
  const response = await expenses.list({ filter: { ExpenseDate: expenseDate }, pageNo: 1, pageSize: 10 });
  return normalizeItems<DailyExpense>(response).find((expense) => expense.ExpenseDate === expenseDate) ?? null;
}

export type ChargePerson = { userId: string; userName: string; userEmail: string; amount: number; entry?: MealEntry };

// Records a day's expense and charges each chosen person their share:
// one ledger charge per person, their sign-up marked charged (or created,
// for someone the admin added), and sign-ups of people left out removed.
export async function chargeDay(input: {
  expenseDate: string;
  totalAmount: number;
  note: string;
  enteredByName: string;
  files: File[];
  people: ChargePerson[];
  removed: MealEntry[];
}) {
  if (!(input.totalAmount > 0)) throw new Error("Enter the day's total cost.");
  if (input.people.length === 0) throw new Error("Choose at least one person who ate.");
  const sum = roundMoney(input.people.reduce((total, person) => total + person.amount, 0));
  if (Math.abs(sum - roundMoney(input.totalAmount)) > 0.005) {
    throw new Error(`The people's amounts add up to ${sum.toFixed(2)}, not the total of ${input.totalAmount.toFixed(2)}.`);
  }
  if (input.people.some((person) => !(person.amount >= 0))) throw new Error("Amounts can't be negative.");
  if (await getExpenseForDate(input.expenseDate)) throw new Error("This day has already been charged.");

  // Upload documents first: if one fails, nobody has been charged yet.
  const receipts = await Promise.all(input.files.map((file) => uploadReceipt(file, input.expenseDate)));
  await expenses.create({
    EnteredByName: input.enteredByName,
    ExpenseDate: input.expenseDate,
    HeadCount: input.people.length,
    Note: input.note,
    // Average share; individual amounts live on each ledger charge.
    PerHeadAmount: roundMoney(input.totalAmount / input.people.length),
    ReceiptFileIds: receipts.map((receipt) => receipt.fileId),
    ReceiptFileNames: receipts.map((receipt) => receipt.name),
    TotalAmount: roundMoney(input.totalAmount)
  });
  // The create response doesn't reliably carry the new id, so read it back.
  const expense = await getExpenseForDate(input.expenseDate);
  const expenseId = String(expense?.ItemId ?? expense?.itemId ?? "");

  const results = await Promise.allSettled([
    ...input.people.map(async (person) => {
      const amount = roundMoney(person.amount);
      await addCharge({
        amount,
        dailyExpenseId: expenseId,
        enteredByName: input.enteredByName,
        entryDate: input.expenseDate,
        note: input.note || `Meal on ${input.expenseDate}`,
        userId: person.userId,
        userName: person.userName
      });
      if (person.entry) await markMealCharged(person.entry, amount);
      else await addChargedMeal(person, input.expenseDate, amount);
    }),
    ...input.removed.map((entry) => removeMealEntry(entry))
  ]);
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) throw new Error(`Expense saved, but ${failed} update(s) failed. Check the ledger and meal history before retrying.`);
  return { headCount: input.people.length };
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
