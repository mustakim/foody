// Pure balance math over ledger entries, kept free of the Blocks client so it
// can be unit-tested and reused by the reconciliation check.
import { roundMoney } from "../../lib/blocks/items";

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

// A day's meal charges: linked by expense id, plus any for that date whose
// link was never filled in.
export function chargesForExpense(entries: LedgerEntry[], expenseId: string, expenseDate: string): LedgerEntry[] {
  return entries.filter((entry) => entry.EntryType === "charge" && (entry.DailyExpenseId ? entry.DailyExpenseId === expenseId : entry.EntryDate === expenseDate));
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
