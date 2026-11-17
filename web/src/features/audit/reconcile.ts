// Cross-checks the three money records against each other:
//   DailyExpense (what a day cost) -> LedgerEntry charges (what each person
//   was charged) -> MealEntry.ChargeAmount (what meal history shows).
// Every day's expense should equal the sum of its charges and of its charged
// meal entries, and every person's ledger charges should equal their meal
// history. Pure: takes plain records, so it can be unit-tested.
import { roundMoney } from "../../lib/blocks/items";
import type { LedgerEntry } from "../ledger/ledgerMath";

type Row = Record<string, unknown>;
export type ExpenseRecord = Row & { ItemId?: string; ExpenseDate?: string; TotalAmount?: number; HeadCount?: number };
export type MealRecord = Row & { ItemId?: string; UserId?: string; UserName?: string; MealDate?: string; IsCharged?: boolean; ChargeAmount?: number };

export type DayCheck = {
  date: string;
  expenseTotal: number;
  headCount: number;
  expenseCount: number;
  charged: number;
  chargeCount: number;
  mealCharged: number;
  mealCount: number;
  issues: string[];
};

export type PersonCheck = {
  userId: string;
  userName: string;
  credited: number;
  adjusted: number;
  charged: number;
  mealCost: number;
  balance: number;
  issues: string[];
};

export type Reconciliation = {
  totals: {
    expenses: number;
    charges: number;
    mealCharged: number;
    credits: number;
    adjustments: number;
    advanceNet: number;
    balances: number;
    due: number;
    dueCount: number;
    unallocated: number;
    cashRemaining: number;
  };
  days: DayCheck[];
  people: PersonCheck[];
  issues: string[];
};

const KNOWN_TYPES = new Set(["credit", "charge", "adjustment"]);
const differs = (a: number, b: number) => Math.abs(roundMoney(a) - roundMoney(b)) > 0.005;
const money = (value: unknown) => roundMoney(Number(value ?? 0));
const show = (value: number) => value.toFixed(2);

export function reconcile(expenses: ExpenseRecord[], ledger: LedgerEntry[], meals: MealRecord[]): Reconciliation {
  const issues: string[] = [];
  const expenseIds = new Map<string, string>();
  const days = new Map<string, DayCheck>();
  const day = (date: string) => {
    let current = days.get(date);
    if (!current) {
      current = { charged: 0, chargeCount: 0, date, expenseCount: 0, expenseTotal: 0, headCount: 0, issues: [], mealCharged: 0, mealCount: 0 };
      days.set(date, current);
    }
    return current;
  };

  for (const expense of expenses) {
    const current = day(String(expense.ExpenseDate ?? ""));
    current.expenseCount += 1;
    current.expenseTotal = roundMoney(current.expenseTotal + money(expense.TotalAmount));
    current.headCount += Number(expense.HeadCount ?? 0);
    if (expense.ItemId) expenseIds.set(String(expense.ItemId), current.date);
  }

  const charges = ledger.filter((entry) => entry.EntryType === "charge");
  const seen = new Map<string, number>();
  for (const entry of charges) {
    // A charge belongs to the day of its expense; fall back to its own date.
    const date = (entry.DailyExpenseId && expenseIds.get(String(entry.DailyExpenseId))) || String(entry.EntryDate ?? "");
    const current = day(date);
    current.charged = roundMoney(current.charged + money(entry.Amount));
    current.chargeCount += 1;
    if (entry.DailyExpenseId && !expenseIds.has(String(entry.DailyExpenseId))) {
      current.issues.push(`${entry.UserName ?? entry.UserId}'s charge points to an expense that no longer exists.`);
    }
    const key = `${date}|${entry.UserId}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      const [date, userId] = key.split("|");
      const name = charges.find((entry) => String(entry.UserId) === userId)?.UserName ?? userId;
      day(date ?? "").issues.push(`${name} is charged ${count} times on this day.`);
    }
  }

  for (const meal of meals) {
    const current = day(String(meal.MealDate ?? ""));
    if (meal.IsCharged) {
      current.mealCharged = roundMoney(current.mealCharged + money(meal.ChargeAmount));
      current.mealCount += 1;
    }
  }

  for (const current of days.values()) {
    if (current.expenseCount > 1) current.issues.push(`${current.expenseCount} expense records exist for this day; only one is expected.`);
    if (current.expenseCount === 0 && current.chargeCount > 0) current.issues.push(`People were charged ${show(current.charged)} but there is no expense for this day.`);
    if (current.expenseCount > 0 && current.chargeCount === 0) current.issues.push(`The expense of ${show(current.expenseTotal)} was not charged to anyone.`);
    else if (current.expenseCount > 0 && differs(current.expenseTotal, current.charged)) {
      current.issues.push(`Charges add up to ${show(current.charged)}, not the expense of ${show(current.expenseTotal)}.`);
    }
    if (current.expenseCount > 0 && current.chargeCount > 0 && current.chargeCount !== current.headCount) {
      current.issues.push(`${current.chargeCount} people were charged, but the expense says ${current.headCount}.`);
    }
    if (differs(current.charged, current.mealCharged) || current.chargeCount !== current.mealCount) {
      current.issues.push(`Meal history shows ${current.mealCount} charged meals for ${show(current.mealCharged)}; the ledger has ${current.chargeCount} charges for ${show(current.charged)}.`);
    }
  }

  const people = new Map<string, PersonCheck>();
  const person = (userId: string, userName: string) => {
    let current = people.get(userId);
    if (!current) {
      current = { adjusted: 0, balance: 0, charged: 0, credited: 0, issues: [], mealCost: 0, userId, userName };
      people.set(userId, current);
    }
    if (!current.userName && userName) current.userName = userName;
    return current;
  };
  for (const entry of ledger) {
    if (!entry.UserId) {
      issues.push(`A ${entry.EntryType ?? "ledger"} entry of ${show(money(entry.Amount))} has no person.`);
      continue;
    }
    if (!KNOWN_TYPES.has(String(entry.EntryType))) issues.push(`A ledger entry for ${entry.UserName ?? entry.UserId} has an unknown type "${entry.EntryType ?? ""}".`);
    const current = person(String(entry.UserId), String(entry.UserName ?? ""));
    if (entry.EntryType === "charge") current.charged = roundMoney(current.charged + money(entry.Amount));
    else if (entry.EntryType === "adjustment") current.adjusted = roundMoney(current.adjusted + money(entry.Amount));
    else current.credited = roundMoney(current.credited + money(entry.Amount));
  }
  for (const meal of meals) {
    if (!meal.IsCharged || !meal.UserId) continue;
    const current = person(String(meal.UserId), String(meal.UserName ?? ""));
    current.mealCost = roundMoney(current.mealCost + money(meal.ChargeAmount));
  }
  for (const current of people.values()) {
    current.balance = roundMoney(current.credited + current.adjusted - current.charged);
    if (differs(current.charged, current.mealCost)) {
      current.issues.push(`Ledger meal cost ${show(current.charged)} vs meal history ${show(current.mealCost)}.`);
    }
  }

  const sum = (values: number[]) => roundMoney(values.reduce((total, value) => total + value, 0));
  const peopleList = [...people.values()].sort((a, b) => a.userName.localeCompare(b.userName));
  const totals = {
    adjustments: sum(peopleList.map((row) => row.adjusted)),
    advanceNet: sum(peopleList.map((row) => row.credited + row.adjusted)),
    balances: sum(peopleList.map((row) => row.balance)),
    cashRemaining: 0,
    charges: sum(charges.map((entry) => money(entry.Amount))),
    credits: sum(peopleList.map((row) => row.credited)),
    due: sum(peopleList.filter((row) => row.balance < 0).map((row) => -row.balance)),
    dueCount: peopleList.filter((row) => row.balance < 0).length,
    expenses: sum(expenses.map((expense) => money(expense.TotalAmount))),
    mealCharged: sum(meals.filter((meal) => meal.IsCharged).map((meal) => money(meal.ChargeAmount))),
    unallocated: 0
  };
  totals.unallocated = roundMoney(totals.expenses - totals.charges);
  totals.cashRemaining = roundMoney(totals.advanceNet - totals.expenses);
  if (differs(totals.expenses, totals.charges)) {
    issues.push(`Expenses total ${show(totals.expenses)}, but only ${show(totals.charges)} was charged to people (${show(totals.unallocated)} not shared out).`);
  }

  return {
    days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)),
    issues,
    people: peopleList,
    totals
  };
}
