/** 한 번에 공유할 수 있는 작품 수. 클라이언트 사전 확인과 create-library-share가 같은 값을 쓴다. */
export const LIBRARY_SHARE_MAX_ITEMS = 1000;

/** PostgREST `in` 조건은 URL에 실려 1000개 UUID(약 37KB)면 400이 난다. 100개(약 3.8KB)씩 나눠 조회한다. */
export const LIBRARY_SHARE_QUERY_CHUNK = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("chunk size must be a positive integer");
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
