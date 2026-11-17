import { describe, expect, it } from "vitest";
import { balanceOf, balancesByUser, chargesForExpense } from "./ledgerMath";
import type { LedgerEntry } from "./ledgerMath";

const entries: LedgerEntry[] = [
  { Amount: 1108, EntryType: "credit", UserId: "u1", UserName: "A" },
  { Amount: -500, EntryType: "adjustment", UserId: "u1", UserName: "A" },
  { Amount: 613.55, EntryType: "charge", UserId: "u1", UserName: "A", DailyExpenseId: "e1", EntryDate: "2026-11-15" },
  { Amount: 106, EntryType: "charge", UserId: "u2", UserName: "B", DailyExpenseId: "e1", EntryDate: "2026-11-15" },
  { Amount: 50, EntryType: "charge", UserId: "u2", UserName: "B", EntryDate: "2026-11-12" }
];

describe("balancesByUser", () => {
  it("balance = advance + adjustments - meal cost for each person", () => {
    const balances = balancesByUser(entries);
    expect(balances.get("u1")).toMatchObject({ adjusted: -500, balance: -5.55, charged: 613.55, credited: 1108 });
    expect(balances.get("u2")).toMatchObject({ balance: -156, charged: 156, credited: 0 });
  });

  it("agrees with balanceOf for one person", () => {
    expect(balanceOf(entries.filter((entry) => entry.UserId === "u1"))).toBe(-5.55);
  });
});

describe("chargesForExpense", () => {
  it("matches charges by expense id, or by date when the id is missing", () => {
    expect(chargesForExpense(entries, "e1", "2026-11-15")).toHaveLength(2);
    expect(chargesForExpense(entries, "e2", "2026-11-12")).toHaveLength(1);
  });
});
