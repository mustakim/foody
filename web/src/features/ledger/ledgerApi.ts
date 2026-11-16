import { blocksClient } from "../../lib/blocks/client";
import { itemId, listAllItems, roundMoney } from "../../lib/blocks/items";

export type LedgerEntry = Record<string, unknown> & {
  ItemId?: string;
  UserId?: string;
  UserName?: string;
  // credit = advance paid, charge = meal cost, adjustment = admin correction
  // (Amount is signed: positive adds to the balance, negative deducts).
  EntryType?: "credit" | "charge" | "adjustment";
  Amount?: number;
  EntryDate?: string;
  Note?: string;
  DailyExpenseId?: string;
  EnteredByName?: string;
  CreatedDate?: string;
};

const ledger = blocksClient.data.collection<LedgerEntry>("LedgerEntry", {
  fields: ["UserId", "UserName", "EntryType", "Amount", "EntryDate", "Note", "DailyExpenseId", "EnteredByName", "CreatedDate"]
});

export async function listLedger(userId?: string): Promise<LedgerEntry[]> {
  const items = await listAllItems<LedgerEntry>(ledger, userId ? { UserId: userId } : {});
  return (userId ? items.filter((entry) => entry.UserId === userId) : items).sort(byNewest);
}

export function addCredit(input: { userId: string; userName: string; amount: number; note: string; entryDate: string; enteredByName: string }) {
  if (!(input.amount > 0)) throw new Error("Credit amount must be more than zero.");
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
  if (entry.EntryType === "charge") throw new Error("Meal charges can't be deleted here.");
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

// Credits add to the balance, meal charges subtract from it, adjustments
// carry their own sign.
export function signedAmount(entry: LedgerEntry): number {
  const amount = Number(entry.Amount ?? 0);
  return entry.EntryType === "charge" ? -amount : amount;
}

export function balanceOf(entries: LedgerEntry[]): number {
  return roundMoney(entries.reduce((sum, entry) => sum + signedAmount(entry), 0));
}

export type UserBalance = { userId: string; userName: string; credited: number; charged: number; adjusted: number; balance: number };

export function balancesByUser(entries: LedgerEntry[]): Map<string, UserBalance> {
  const balances = new Map<string, UserBalance>();
  for (const entry of entries) {
    if (!entry.UserId) continue;
    const current = balances.get(entry.UserId) ?? { adjusted: 0, balance: 0, charged: 0, credited: 0, userId: entry.UserId, userName: entry.UserName ?? "" };
    const amount = Number(entry.Amount ?? 0);
    if (entry.EntryType === "charge") current.charged = roundMoney(current.charged + amount);
    else if (entry.EntryType === "adjustment") current.adjusted = roundMoney(current.adjusted + amount);
    else current.credited = roundMoney(current.credited + amount);
    current.balance = roundMoney(current.credited - current.charged + current.adjusted);
    balances.set(entry.UserId, current);
  }
  return balances;
}

function byNewest(a: LedgerEntry, b: LedgerEntry): number {
  const dateOrder = String(b.EntryDate ?? "").localeCompare(String(a.EntryDate ?? ""));
  return dateOrder || String(b.CreatedDate ?? "").localeCompare(String(a.CreatedDate ?? ""));
}
