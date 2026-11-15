export const SIMILARITY_PAGINATION_VERSION = "similarity-snapshot-v2";
export const SIMILARITY_SNAPSHOT_TTL_MS = 15 * 60_000;

export class SimilarContentPagingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "SimilarContentPagingError";
  }
}

export interface SimilarityCursor {
  snapshot: string;
  offset: number;
  scope: string;
}
export interface SimilaritySnapshot<T, A> {
  id: string;
  scope: string;
  anchor: A;
  items: T[];
  warnings: string[];
  expires_at: string;
  pagination_version: typeof SIMILARITY_PAGINATION_VERSION;
}

export function validateSimilarityLimit(value: unknown): number {
  if (value === undefined) return 12;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 24) {
    throw new SimilarContentPagingError(
      400,
      "INVALID_REQUEST",
      "한 번에 불러올 작품 수는 1~24 사이의 정수여야 해요."
    );
  }
  return value;
}

export async function createSimilarityScope(input: {
  anchor: {
    external_source: string;
    external_id: string;
    content_type?: string;
    season_number?: number | null;
  };
  target: string;
  focus: string;
  sort: string;
  modifiers: readonly { key: string; direction: string }[];
  limit: number;
  responseVersion?: string;
}): Promise<string> {
  const modifiers = [
    ...new Set(input.modifiers.map((item) => `${item.direction}:${item.key}`))
  ].sort();
  const value = JSON.stringify([
    SIMILARITY_PAGINATION_VERSION,
    input.anchor.external_source,
    input.anchor.external_id,
    input.anchor.content_type ?? "",
    input.anchor.season_number ?? null,
    input.target,
    input.focus,
    input.sort,
    modifiers,
    input.limit,
    input.responseVersion ?? "similarity-snapshot-v1"
  ]);
  return digestScope(value);
}

export function createPersonalSimilarityScope(
  publicScope: string,
  userId: string,
  librarySignature: string
): Promise<string> {
  return digestScope(JSON.stringify([
    SIMILARITY_PAGINATION_VERSION,
    "personal-library-projection",
    publicScope,
    userId,
    librarySignature
  ]));
}

async function digestScope(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSimilaritySnapshot<T, A>(input: {
  id: string;
  scope: string;
  anchor: A;
  items: readonly T[];
  warnings: readonly string[];
  now?: number;
  ttlMs?: number;
}): SimilaritySnapshot<T, A> {
  return {
    id: input.id,
    scope: input.scope,
    anchor: input.anchor,
    items: [...input.items],
    warnings: [...input.warnings],
    expires_at: new Date(
      (input.now ?? Date.now()) + (input.ttlMs ?? SIMILARITY_SNAPSHOT_TTL_MS)
    ).toISOString(),
    pagination_version: SIMILARITY_PAGINATION_VERSION
  };
}

// This projection is response-only. Persist only the original public snapshot.
export function projectSimilaritySnapshot<T, A>(
  publicSnapshot: SimilaritySnapshot<T, A>,
  personalScope: string,
  items: readonly T[]
): SimilaritySnapshot<T, A> {
  return {
    ...publicSnapshot,
    scope: personalScope,
    items: [...items],
    warnings: [...publicSnapshot.warnings]
  };
}

export function decodeSimilarityCursor(value: unknown): SimilarityCursor | null {
  if (value === null || value === undefined) return null;
  try {
    if (typeof value !== "string" || value.length > 512 || !/^sc[12]\.[A-Za-z0-9_-]+$/.test(value))
      throw new Error();
    const encoded = value.slice(4).replace(/-/g, "+").replace(/_/g, "/");
    const decoded: unknown = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))
    );
    if (
      !isRecord(decoded) ||
      typeof decoded.snapshot !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.snapshot) ||
      typeof decoded.offset !== "number" ||
      !Number.isSafeInteger(decoded.offset) ||
      decoded.offset < 1 ||
      typeof decoded.scope !== "string" ||
      !/^[0-9a-f]{64}$/.test(decoded.scope)
    )
      throw new Error();
    if (value.startsWith("sc1.")) {
      throw new SimilarContentPagingError(
        409,
        "SIMILARITY_RESTART_REQUIRED",
        "이어 찾기 방식이 바뀌었어요. 처음부터 다시 찾아 주세요."
      );
    }
    return { snapshot: decoded.snapshot, offset: decoded.offset, scope: decoded.scope };
  } catch (error) {
    if (error instanceof SimilarContentPagingError) throw error;
    throw new SimilarContentPagingError(
      400,
      "INVALID_REQUEST",
      "이어 찾기 정보가 올바르지 않아요. 처음부터 다시 찾아 주세요."
    );
  }
}

export function pageSimilaritySnapshot<T, A>(
  snapshot: SimilaritySnapshot<T, A> | null,
  scope: string,
  limit: number,
  cursor?: unknown,
  now = Date.now()
) {
  validateSimilarityLimit(limit);
  const decoded = decodeSimilarityCursor(cursor);
  if (
    !snapshot ||
    snapshot.pagination_version !== SIMILARITY_PAGINATION_VERSION ||
    snapshot.scope !== scope ||
    !Array.isArray(snapshot.items) ||
    !Array.isArray(snapshot.warnings) ||
    !(Date.parse(snapshot.expires_at) > now) ||
    (decoded &&
      (decoded.scope !== scope ||
        decoded.snapshot !== snapshot.id ||
        decoded.offset >= snapshot.items.length ||
        decoded.offset % limit !== 0))
  ) {
    throw new SimilarContentPagingError(
      409,
      "SIMILARITY_RESTART_REQUIRED",
      "이어 찾기 정보가 만료되었거나 검색 조건이 바뀌었어요. 처음부터 다시 찾아 주세요."
    );
  }
  const offset = decoded?.offset ?? 0;
  const end = Math.min(snapshot.items.length, offset + limit);
  const hasMore = end < snapshot.items.length;
  return {
    anchor: snapshot.anchor,
    items: snapshot.items.slice(offset, end),
    warnings: [...snapshot.warnings],
    has_more: hasMore,
    next_cursor: hasMore
      ? encodeSimilarityCursor({ snapshot: snapshot.id, offset: end, scope })
      : null,
    total_count: snapshot.items.length,
    pagination_version: SIMILARITY_PAGINATION_VERSION
  };
}

function encodeSimilarityCursor(value: SimilarityCursor): string {
  return (
    "sc2." + btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
