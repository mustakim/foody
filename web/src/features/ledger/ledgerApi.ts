import { blocksClient } from "../../lib/blocks/client";
import { normalizeItems, roundMoney } from "../../lib/blocks/items";

export type LedgerEntry = Record<string, unknown> & {
  ItemId?: string;
  UserId?: string;
  UserName?: string;
  EntryType?: "credit" | "charge";
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

// Small office ledger: one page covers it. Raise this (or page through) if
// the team grows past a few thousand entries.
const LEDGER_PAGE_SIZE = 5000;

export async function listLedger(userId?: string): Promise<LedgerEntry[]> {
  const response = await ledger.list({ filter: userId ? { UserId: userId } : {}, pageNo: 1, pageSize: LEDGER_PAGE_SIZE });
  const items = normalizeItems<LedgerEntry>(response);
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

// Credits add to the balance, meal charges subtract from it.
export function signedAmount(entry: LedgerEntry): number {
  const amount = Number(entry.Amount ?? 0);
  return entry.EntryType === "charge" ? -amount : amount;
}

export function balanceOf(entries: LedgerEntry[]): number {
  return roundMoney(entries.reduce((sum, entry) => sum + signedAmount(entry), 0));
}

export type UserBalance = { userId: string; userName: string; credited: number; charged: number; balance: number };

export function balancesByUser(entries: LedgerEntry[]): Map<string, UserBalance> {
  const balances = new Map<string, UserBalance>();
  for (const entry of entries) {
    if (!entry.UserId) continue;
    const current = balances.get(entry.UserId) ?? { balance: 0, charged: 0, credited: 0, userId: entry.UserId, userName: entry.UserName ?? "" };
    const amount = Number(entry.Amount ?? 0);
    if (entry.EntryType === "charge") current.charged = roundMoney(current.charged + amount);
    else current.credited = roundMoney(current.credited + amount);
    current.balance = roundMoney(current.credited - current.charged);
    balances.set(entry.UserId, current);
  }
  return balances;
}

function byNewest(a: LedgerEntry, b: LedgerEntry): number {
  const dateOrder = String(b.EntryDate ?? "").localeCompare(String(a.EntryDate ?? ""));
  return dateOrder || String(b.CreatedDate ?? "").localeCompare(String(a.CreatedDate ?? ""));
}
