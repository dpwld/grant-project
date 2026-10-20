export async function collectPages<T>(load: (page: number) => Promise<T[]>, key: (item: T) => string, pageSize = 100): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + 80_000;
  for (let page = 1; page <= 100; page++) {
    if (Date.now() > deadline) throw new Error(`Collection timed out after ${page - 1} pages and ${rows.length} records; collection is incomplete`);
    const items = await load(page);
    if (items.length === 0) return rows;
    const fresh = items.filter(item => !seen.has(key(item)));
    if (!fresh.length) throw new Error("The announcement API repeated the same page; collection is incomplete");
    for (const item of fresh) { if (!seen.has(key(item))) { seen.add(key(item)); rows.push(item); } }
    if (items.length < pageSize) return rows;
  }
  throw new Error("The page limit was reached; collection is incomplete");
}
