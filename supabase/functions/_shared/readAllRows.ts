interface QueryPage<T> { data: T[] | null; error: { message: string } | null }

/** Bounded server reads fail closed instead of calculating with a truncated user library. */
export async function readAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  options: { pageSize?: number; maxPages?: number; rowKey?: (row: T) => string | null | undefined } = {}
): Promise<QueryPage<T>> {
  const { pageSize = 1000, maxPages = 50, rowKey } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(maxPages) || maxPages < 1) throw new Error("Invalid query page size");
  const data: T[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const result = await readPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data ?? [];
    for (const row of rows) {
      const key = rowKey?.(row);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      data.push(row);
    }
    if (rows.length < pageSize) return { data, error: null };
  }
  return { data: null, error: { message: "ROW_LIMIT_EXCEEDED" } };
}
