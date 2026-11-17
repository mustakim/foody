// Meals are counted per calendar day in the viewer's own timezone, stored as
// YYYY-MM-DD so a day is an exact-match filter rather than a date range.
export function todayKey(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// A sign-up can be cancelled until 4 PM (viewer's local time) on its day;
// after that the order is placed. Past days can't be cancelled at all.
export const CANCEL_CUTOFF_HOUR = 16;
export const CANCEL_CUTOFF_LABEL = "4 PM";

export function canCancel(mealDate: string, now = new Date()): boolean {
  const today = todayKey(now);
  if (mealDate > today) return true;
  return mealDate === today && now.getHours() < CANCEL_CUTOFF_HOUR;
}
