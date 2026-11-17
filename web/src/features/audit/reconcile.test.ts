import { describe, expect, it } from "vitest";
import { reconcile } from "./reconcile";

const expenses = [
  { ExpenseDate: "2026-11-15", HeadCount: 2, ItemId: "e15", TotalAmount: 100 },
  { ExpenseDate: "2026-11-05", HeadCount: 2, ItemId: "e05", TotalAmount: 978 }
];
const ledger = [
  { Amount: 500, EntryType: "credit" as const, UserId: "u1", UserName: "A" },
  { Amount: 100, EntryType: "credit" as const, UserId: "u2", UserName: "B" },
  { Amount: 50, DailyExpenseId: "e15", EntryDate: "2026-11-15", EntryType: "charge" as const, UserId: "u1", UserName: "A" },
  { Amount: 50, DailyExpenseId: "e15", EntryDate: "2026-11-15", EntryType: "charge" as const, UserId: "u2", UserName: "B" }
];
const meals = [
  { ChargeAmount: 50, IsCharged: true, MealDate: "2026-11-15", UserId: "u1", UserName: "A" },
  { ChargeAmount: 50, IsCharged: true, MealDate: "2026-11-15", UserId: "u2", UserName: "B" }
];

describe("reconcile", () => {
  it("finds an expense that was never charged to anyone", () => {
    const result = reconcile(expenses, ledger, meals);
    expect(result.totals).toMatchObject({ charges: 100, expenses: 1078, unallocated: 978 });
    expect(result.days.find((day) => day.date === "2026-11-05")?.issues[0]).toMatch(/not charged to anyone/);
    expect(result.days.find((day) => day.date === "2026-11-15")?.issues).toEqual([]);
  });

  it("totals reconcile: balances = net advance - charges, cash = net advance - expenses", () => {
    const { totals } = reconcile(expenses, ledger, meals);
    expect(totals.balances).toBe(totals.advanceNet - totals.charges);
    expect(totals.cashRemaining).toBe(totals.advanceNet - totals.expenses);
    expect(totals.balances - totals.cashRemaining).toBe(totals.unallocated);
  });

  it("flags duplicate charges and charges whose expense is gone", () => {
    const result = reconcile(expenses.slice(0, 1), [...ledger, { ...ledger[2]! }, { Amount: 20, DailyExpenseId: "gone", EntryDate: "2026-11-01", EntryType: "charge" as const, UserId: "u1" }], meals);
    const issues = result.days.flatMap((day) => day.issues).join("\n");
    expect(issues).toMatch(/charged 2 times/);
    expect(issues).toMatch(/no longer exists/);
  });

  it("flags a person whose ledger and meal history disagree", () => {
    const result = reconcile(expenses.slice(0, 1), ledger, meals.slice(0, 1));
    expect(result.people.find((row) => row.userId === "u2")?.issues[0]).toMatch(/snacks history 0.00/);
  });

  it("ignores uncharged sign-ups", () => {
    const result = reconcile(expenses.slice(0, 1), ledger, [...meals, { ChargeAmount: 0, IsCharged: false, MealDate: "2026-11-16", UserId: "u1" }]);
    expect(result.days.find((day) => day.date === "2026-11-16")?.issues).toEqual([]);
  });
});
