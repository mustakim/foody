import { describe, expect, it } from "vitest";
import { canCancel, todayKey } from "./mealRules";

const at = (hour: number, minute = 0) => new Date(2026, 10, 17, hour, minute);

describe("canCancel", () => {
  it("allows cancelling today's sign-up before 4 PM", () => {
    expect(canCancel("2026-11-17", at(9))).toBe(true);
    expect(canCancel("2026-11-17", at(15, 59))).toBe(true);
  });

  it("blocks cancelling from 4 PM onwards", () => {
    expect(canCancel("2026-11-17", at(16))).toBe(false);
    expect(canCancel("2026-11-17", at(23, 30))).toBe(false);
  });

  it("blocks past days and allows future days", () => {
    expect(canCancel("2026-11-16", at(9))).toBe(false);
    expect(canCancel("2026-11-18", at(20))).toBe(true);
  });

  it("todayKey uses the local date", () => {
    expect(todayKey(at(0, 5))).toBe("2026-11-17");
  });
});
