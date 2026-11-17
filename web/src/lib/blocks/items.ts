// Data Gateway list responses nest items under the query name
// (e.g. data.getMealEntries.items); this finds them whatever the nesting.
export function normalizeItems<T>(response: unknown): T[] {
  const record = response as { data?: Record<string, { items?: T[] } | T[] | undefined>; items?: T[] };
  if (record.items) return record.items;
  const data = record.data ?? {};
  if (Array.isArray(data.items)) return data.items;
  for (const value of Object.values(data)) {
    if (value && !Array.isArray(value) && Array.isArray(value.items)) return value.items;
  }
  return [];
}

// The gateway caps how many items one page returns, whatever pageSize is
// asked for, so reading "everything" walks pages until the server's own
// totalCount is reached. Pages are sorted by ItemId so records can't shift
// between pages, and duplicates are dropped by id.
const PAGE_SIZE = 100;
const MAX_PAGES = 500;

type ListFn = (options: { filter?: Record<string, unknown>; pageNo: number; pageSize: number; sort?: Record<string, number> }) => Promise<unknown>;

export function pageTotalCount(response: unknown): number | undefined {
  const data = (response as { data?: Record<string, unknown> }).data ?? {};
  for (const value of [response, data, ...Object.values(data)]) {
    const count = (value as { totalCount?: unknown } | null)?.totalCount;
    if (typeof count === "number") return count;
  }
  return undefined;
}

export async function listAllItems<T extends Record<string, unknown>>(collection: { list: ListFn }, filter: Record<string, unknown> = {}): Promise<T[]> {
  const byId = new Map<string, T>();
  let unkeyed: T[] = [];
  let expected: number | undefined;
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const response = await collection.list({ filter, pageNo, pageSize: PAGE_SIZE, sort: { ItemId: 1 } });
    const page = normalizeItems<T>(response);
    expected ??= pageTotalCount(response);
    for (const item of page) {
      const id = item.ItemId ?? item.itemId ?? item.id;
      if (id) byId.set(String(id), item);
      else unkeyed = [...unkeyed, item];
    }
    const read = byId.size + unkeyed.length;
    if (page.length === 0 || (expected !== undefined ? read >= expected : page.length < PAGE_SIZE)) break;
  }
  return [...byId.values(), ...unkeyed];
}

export function itemId(item: Record<string, unknown>): string {
  const id = item.ItemId ?? item.itemId ?? item.id;
  if (!id) throw new Error("Record id is missing.");
  return String(id);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

// Splits a total into `count` 2-decimal shares that add back up exactly,
// giving the leftover cents to the first shares.
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => (base + (index < cents - base * count ? 1 : 0)) / 100);
}
