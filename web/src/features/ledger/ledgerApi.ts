import { blocksClient } from "../../lib/blocks/client";
import { itemId, listAllItems, roundMoney } from "../../lib/blocks/items";

import type { LedgerEntry } from "./ledgerMath";

export type { LedgerEntry, UserBalance } from "./ledgerMath";
export { balanceOf, balancesByUser, chargesForExpense, signedAmount } from "./ledgerMath";

const ledger = blocksClient.data.collection<LedgerEntry>("LedgerEntry", {
  fields: ["UserId", "UserName", "EntryType", "Amount", "EntryDate", "Note", "DailyExpenseId", "EnteredByName", "CreatedDate"]
});

export async function listLedger(userId?: string): Promise<LedgerEntry[]> {
  const items = await listAllItems<LedgerEntry>(ledger, userId ? { UserId: userId } : {});
  return (userId ? items.filter((entry) => entry.UserId === userId) : items).sort(byNewest);
}

export function addCredit(input: { userId: string; userName: string; amount: number; note: string; entryDate: string; enteredByName: string }) {
  if (!(input.amount > 0)) throw new Error("The balance to add must be more than zero.");
  return ledger.create({
    Amount: roundMoney(input.amount),
    EnteredByName: input.enteredByName,
    EntryDate: input.entryDate,
    EntryType: "credit",
    Note: input.note,
    UserId: input.userId,
    UserName: input.userName
  });
}

export function addAdjustment(input: { userId: string; userName: string; amount: number; note: string; entryDate: string; enteredByName: string }) {
  const amount = roundMoney(input.amount);
  if (!amount) throw new Error("The adjustment can't be zero.");
  if (!input.note.trim()) throw new Error("Add a note saying why the balance is being adjusted.");
  return ledger.create({
    Amount: amount,
    EnteredByName: input.enteredByName,
    EntryDate: input.entryDate,
    EntryType: "adjustment",
    Note: input.note.trim(),
    UserId: input.userId,
    UserName: input.userName
  });
}

// For undoing a mistaken advance or adjustment. Meal charges belong to a
// day's expense, so they aren't removed one by one.
export function deleteLedgerEntry(entry: LedgerEntry) {
  if (entry.EntryType === "charge") throw new Error("Snacks charges can't be deleted here.");
  return ledger.delete(itemId(entry));
}

export function addCharge(input: { userId: string; userName: string; amount: number; entryDate: string; dailyExpenseId: string; note: string; enteredByName: string }) {
  return ledger.create({
    Amount: roundMoney(input.amount),
    DailyExpenseId: input.dailyExpenseId,
    EnteredByName: input.enteredByName,
    EntryDate: input.entryDate,
    EntryType: "charge",
    Note: input.note,
    UserId: input.userId,
    UserName: input.userName
  });
}

// Used when an admin edits a charged day: change or drop one person's share.
export function updateChargeAmount(entry: LedgerEntry, amount: number, note: string) {
  return ledger.update(itemId(entry), { Amount: roundMoney(amount), Note: note });
}

export function removeCharge(entry: LedgerEntry) {
  return ledger.delete(itemId(entry));
}

function byNewest(a: LedgerEntry, b: LedgerEntry): number {
  const dateOrder = String(b.EntryDate ?? "").localeCompare(String(a.EntryDate ?? ""));
  return dateOrder || String(b.CreatedDate ?? "").localeCompare(String(a.CreatedDate ?? ""));
}
