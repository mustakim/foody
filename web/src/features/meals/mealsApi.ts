import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { itemId, listAllItems } from "../../lib/blocks/items";
import { userDisplayName } from "../profile/useCurrentUser";
import { CANCEL_CUTOFF_LABEL, canCancel } from "./mealRules";

export type MealEntry = Record<string, unknown> & {
  ItemId?: string;
  UserId?: string;
  UserName?: string;
  UserEmail?: string;
  MealDate?: string;
  IsCharged?: boolean;
  ChargeAmount?: number;
};

const mealEntries = blocksClient.data.collection<MealEntry>("MealEntry", {
  fields: ["UserId", "UserName", "UserEmail", "MealDate", "IsCharged", "ChargeAmount", "CreatedDate"]
});

export { todayKey } from "./mealRules";

export async function listMealEntries(mealDate: string): Promise<MealEntry[]> {
  // Filter again locally so a gateway that ignores an unsupported filter
  // can never show another day's sign-ups as today's.
  return (await listAllItems<MealEntry>(mealEntries, { MealDate: mealDate })).filter((entry) => entry.MealDate === mealDate);
}

export function joinMeal(profile: BlocksUser, mealDate: string) {
  if (!profile.itemId) throw new Error("Your user id is missing; sign in again.");
  return mealEntries.create({
    ChargeAmount: 0,
    IsCharged: false,
    MealDate: mealDate,
    UserEmail: profile.email ?? "",
    UserId: profile.itemId,
    UserName: userDisplayName(profile)
  });
}

export function leaveMeal(entry: MealEntry) {
  if (entry.IsCharged) throw new Error("These snacks have already been charged and can no longer be cancelled.");
  if (!canCancel(String(entry.MealDate ?? ""))) throw new Error(`Sign-ups can't be cancelled after ${CANCEL_CUTOFF_LABEL}.`);
  return mealEntries.delete(itemId(entry));
}

export function markMealCharged(entry: MealEntry, amount: number) {
  return mealEntries.update(itemId(entry), { ChargeAmount: amount, IsCharged: true });
}

export function listAllMealEntries(): Promise<MealEntry[]> {
  return listAllItems<MealEntry>(mealEntries);
}

// All sign-ups whose MealDate starts with the given month (YYYY-MM). The
// gateway filter is an exact match, so fetch and narrow by month locally.
export async function listMealEntriesForMonth(month: string): Promise<MealEntry[]> {
  return (await listAllMealEntries()).filter((entry) => String(entry.MealDate ?? "").startsWith(month));
}

// Admin adds someone who ate without signing up; the entry is charged at once.
export function addChargedMeal(person: { userId: string; userName: string; userEmail: string }, mealDate: string, amount: number) {
  return mealEntries.create({
    ChargeAmount: amount,
    IsCharged: true,
    MealDate: mealDate,
    UserEmail: person.userEmail,
    UserId: person.userId,
    UserName: person.userName
  });
}

// Admin removes a sign-up for someone who didn't eat after all.
export function removeMealEntry(entry: MealEntry) {
  return mealEntries.delete(itemId(entry));
}
