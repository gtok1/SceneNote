interface QueryPage<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Keep PostgREST URLs bounded and read beyond its default row limit. */
export async function readBatchedRows<T>(
  ids: readonly string[],
  readPage: (ids: string[], from: number, to: number) => PromiseLike<QueryPage<T>>,
  batchSize = 100,
  pageSize = 1000
): Promise<QueryPage<T>> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Invalid query batch or page size");
  }
  const uniqueIds = [...new Set(ids)];
  const data: T[] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
    const batch = uniqueIds.slice(offset, offset + batchSize);
    for (let from = 0; ; from += pageSize) {
      const page = await readPage(batch, from, from + pageSize - 1);
      if (page.error) return { data: null, error: page.error };
      const rows = page.data ?? [];
      data.push(...rows);
      if (rows.length < pageSize) break;
    }
  }
  return { data, error: null };
}

/** Read one query to completion; never return a truncated success at the safety limit (docs/72 D-1). */
export async function readAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  options: { pageSize?: number; maxPages?: number; rowKey?: (row: T) => string | null | undefined } = {}
): Promise<QueryPage<T>> {
  const { pageSize = 1000, maxPages = 50, rowKey } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("Invalid query page size");
  }

  const data: T[] = [];
  const seen = new Set<string>();
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const from = pageIndex * pageSize;
    const page = await readPage(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    const rows = page.data ?? [];
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
