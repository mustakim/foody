import { blocksClient } from "../../lib/blocks/client";
import { itemId, listAllItems, normalizeItems, roundMoney } from "../../lib/blocks/items";
import { addCharge, removeCharge, updateChargeAmount } from "../ledger/ledgerApi";
import type { LedgerEntry } from "../ledger/ledgerApi";
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

function validateSplit(totalAmount: number, people: ChargePerson[]) {
  if (!(totalAmount > 0)) throw new Error("Enter the day's total cost.");
  if (people.length === 0) throw new Error("Choose at least one person who had snacks.");
  const sum = roundMoney(people.reduce((total, person) => total + person.amount, 0));
  if (Math.abs(sum - roundMoney(totalAmount)) > 0.005) {
    throw new Error(`The people's amounts add up to ${sum.toFixed(2)}, not the total of ${totalAmount.toFixed(2)}.`);
  }
  if (people.some((person) => !(person.amount >= 0))) throw new Error("Amounts can't be negative.");
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
  validateSplit(input.totalAmount, input.people);
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
        note: input.note || `Snacks on ${input.expenseDate}`,
        userId: person.userId,
        userName: person.userName
      });
      if (person.entry) await markMealCharged(person.entry, amount);
      else await addChargedMeal(person, input.expenseDate, amount);
    }),
    ...input.removed.map((entry) => removeMealEntry(entry))
  ]);
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) throw new Error(`Expense saved, but ${failed} update(s) failed. Check balances and snacks history before retrying.`);
  return { headCount: input.people.length };
}

// Edits a day that was already charged: new total/note, and each person's
// charge updated, added or removed so the ledger matches the new list.
export async function updateDay(input: {
  expense: DailyExpense;
  totalAmount: number;
  note: string;
  enteredByName: string;
  people: ChargePerson[];
  charges: LedgerEntry[];
  removed: MealEntry[];
}) {
  validateSplit(input.totalAmount, input.people);
  const expenseId = itemId(input.expense);
  const expenseDate = String(input.expense.ExpenseDate ?? "");
  const note = input.note || `Snacks on ${expenseDate}`;
  await expenses.update(expenseId, {
    HeadCount: input.people.length,
    Note: input.note,
    PerHeadAmount: roundMoney(input.totalAmount / input.people.length),
    TotalAmount: roundMoney(input.totalAmount)
  });

  const chargesByUser = new Map<string, LedgerEntry[]>();
  for (const charge of input.charges) {
    const userId = String(charge.UserId ?? "");
    chargesByUser.set(userId, [...(chargesByUser.get(userId) ?? []), charge]);
  }
  const kept = new Set(input.people.map((person) => person.userId));

  const results = await Promise.allSettled([
    ...input.people.map(async (person) => {
      const amount = roundMoney(person.amount);
      const [existing, ...duplicates] = chargesByUser.get(person.userId) ?? [];
      if (existing) await updateChargeAmount(existing, amount, note);
      else await addCharge({ amount, dailyExpenseId: expenseId, enteredByName: input.enteredByName, entryDate: expenseDate, note, userId: person.userId, userName: person.userName });
      await Promise.all(duplicates.map(removeCharge));
      if (person.entry) await markMealCharged(person.entry, amount);
      else await addChargedMeal(person, expenseDate, amount);
    }),
    ...[...chargesByUser].filter(([userId]) => !kept.has(userId)).flatMap(([, charges]) => charges.map(removeCharge)),
    ...input.removed.map((entry) => removeMealEntry(entry))
  ]);
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) throw new Error(`Expense updated, but ${failed} change(s) failed. Check balances and snacks history, then save again.`);
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
