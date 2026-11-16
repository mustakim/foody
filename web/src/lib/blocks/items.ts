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

// The gateway caps a page (100 items) whatever pageSize is asked for, so
// reading "everything" means walking pages until a short one comes back.
const PAGE_SIZE = 100;
const MAX_PAGES = 500;

export async function listAllItems<T>(
  collection: { list: (options: { filter?: Record<string, unknown>; pageNo: number; pageSize: number }) => Promise<unknown> },
  filter: Record<string, unknown> = {}
): Promise<T[]> {
  const all: T[] = [];
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const page = normalizeItems<T>(await collection.list({ filter, pageNo, pageSize: PAGE_SIZE }));
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
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
