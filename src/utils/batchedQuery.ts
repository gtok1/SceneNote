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
