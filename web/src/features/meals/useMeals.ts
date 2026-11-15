import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { joinMeal, leaveMeal, listMealEntries, listMealEntriesForMonth } from "./mealsApi";
import type { MealEntry } from "./mealsApi";

// Today's list changes as colleagues sign up, so keep it fresh without a reload.
const MEAL_POLL_MS = 30_000;

export function useMealEntries(mealDate: string) {
  return useQuery({
    queryFn: () => listMealEntries(mealDate),
    queryKey: ["meals", mealDate],
    refetchInterval: MEAL_POLL_MS
  });
}

export function useMealMutations(mealDate: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["meals", mealDate] });

  return {
    join: useMutation({ mutationFn: (profile: BlocksUser) => joinMeal(profile, mealDate), onSuccess: invalidate }),
    leave: useMutation({ mutationFn: (entry: MealEntry) => leaveMeal(entry), onSuccess: invalidate })
  };
}

export function useMealHistory(month: string) {
  return useQuery({ queryFn: () => listMealEntriesForMonth(month), queryKey: ["meals", "month", month] });
}
