import { describe, expect, it } from "vitest";
import { listAllItems, roundMoney, splitEvenly } from "./items";

// A fake Data Gateway collection: returns at most `cap` items per page no
// matter what pageSize is asked for, like the real gateway does.
function fakeCollection(total: number, cap: number, withCount = true) {
  const items = Array.from({ length: total }, (_, index) => ({ ItemId: `id-${String(index).padStart(4, "0")}`, Amount: index }));
  const calls: number[] = [];
  return {
    calls,
    list: async ({ pageNo, pageSize }: { pageNo: number; pageSize: number }) => {
      calls.push(pageNo);
      const size = Math.min(pageSize, cap);
      const page = items.slice((pageNo - 1) * size, pageNo * size);
      return { data: { getThings: { items: page, ...(withCount ? { totalCount: total } : {}) } } };
    }
  };
}

describe("splitEvenly", () => {
  it("shares add back up to the total exactly", () => {
    for (const [total, count] of [[1135, 9], [1015, 11], [978, 7], [100, 3], [0.05, 4]] as const) {
      const shares = splitEvenly(total, count);
      expect(shares).toHaveLength(count);
      expect(roundMoney(shares.reduce((sum, share) => sum + share, 0))).toBe(total);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(0.01 + 1e-9);
    }
  });

  it("returns nothing for zero people", () => {
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe("listAllItems", () => {
  it("reads every record across pages", async () => {
    const collection = fakeCollection(257, 100);
    expect(await listAllItems(collection)).toHaveLength(257);
  });

  it("keeps going when the server caps pages below the requested size", async () => {
    // The old loop stopped after the first short page and lost everything after it.
    const collection = fakeCollection(130, 50);
    expect(await listAllItems(collection)).toHaveLength(130);
    expect(collection.calls).toEqual([1, 2, 3]);
  });

  it("stops on a short page when the server sends no totalCount", async () => {
    const collection = fakeCollection(150, 100, false);
    expect(await listAllItems(collection)).toHaveLength(150);
  });

  it("drops duplicate records returned on two pages", async () => {
    let call = 0;
    const collection = {
      list: async () => {
        call += 1;
        const items = call === 1 ? [{ ItemId: "a" }, { ItemId: "b" }] : [{ ItemId: "b" }, { ItemId: "c" }];
        return { items, totalCount: 3 };
      }
    };
    expect((await listAllItems(collection)).map((item) => item.ItemId)).toEqual(["a", "b", "c"]);
  });
});
