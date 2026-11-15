export interface PersistentMetadataStore {
  read(key: string, source: string): Promise<unknown | null>;
  write(key: string, source: string, value: unknown): Promise<void>;
}

interface PersistentMetadataSelectQuery {
  eq(column: "query_hash" | "source", value: string): PersistentMetadataSelectQuery;
  maybeSingle(): PromiseLike<{ data: { response_json: unknown } | null; error: unknown }>;
}

/** Structural boundary keeps this shared cache usable in pure tests without a Supabase runtime import. */
export interface PersistentMetadataDbClient {
  from(table: "external_search_cache"): {
    select(columns: "response_json"): PersistentMetadataSelectQuery;
    upsert(value: {
      query_hash: string; query_text: string; source: string; response_json: unknown; expires_at: string;
    }, options: { onConflict: "query_hash,source" }): PromiseLike<{ error: unknown }>;
  };
}

/** This namespace stores public metadata only. Existing service-role-only RLS is unchanged. */
export function createPersistentMetadataStore(client: { from: unknown }): PersistentMetadataStore {
  // Keep Supabase's deeply generic client from recursively instantiating at each handler boundary.
  if (typeof client.from !== "function") throw new TypeError("A database client is required");
  const database = client as PersistentMetadataDbClient;
  return {
    async read(key, source) {
      const { data, error } = await database.from("external_search_cache")
        .select("response_json").eq("query_hash", key).eq("source", source).maybeSingle();
      if (error) throw error;
      return data?.response_json ?? null;
    },
    async write(key, source, value) {
      const { error } = await database.from("external_search_cache").upsert({
        query_hash: key, query_text: key, source, response_json: value,
        // PostgreSQL's non-expiring timestamp, rather than an arbitrary far-future date or automatic TTL.
        expires_at: "infinity"
      }, { onConflict: "query_hash,source" });
      if (error) throw error;
    }
  };
}

export type PersistentMetadataCacheErrorCode =
  | "CACHE_READ_FAILED" | "CACHE_WRITE_FAILED" | "INVALID_CACHE_ENTRY" | "INVALID_METADATA_RESPONSE";

export class PersistentMetadataCacheError extends Error {
  constructor(public readonly code: PersistentMetadataCacheErrorCode) {
    super(code);
    this.name = "PersistentMetadataCacheError";
  }
}

export interface PersistentMetadataRequest<T> {
  key: string;
  source: string;
  store: PersistentMetadataStore;
  forceRefresh?: boolean;
  fetchFresh(): Promise<T>;
  isValid(value: unknown): value is T;
}

export async function readThroughPersistentMetadata<T>(
  input: PersistentMetadataRequest<T>
): Promise<{ data: T; fromCache: boolean }> {
  if (!input.forceRefresh) {
    let cached: unknown;
    try {
      cached = await input.store.read(input.key, input.source);
    } catch {
      // A DB outage is not a cache miss: never spend an upstream request trying to conceal it.
      throw new PersistentMetadataCacheError("CACHE_READ_FAILED");
    }
    if (cached !== null) {
      if (!input.isValid(cached)) throw new PersistentMetadataCacheError("INVALID_CACHE_ENTRY");
      return { data: cached, fromCache: true };
    }
  }

  const identity = JSON.stringify([input.source, input.key]);
  const pending = inFlightMetadata.get(identity);
  if (pending) return { data: await pending as T, fromCache: false };

  const request = Promise.resolve().then(async () => {
    const data = await input.fetchFresh();
    if (!input.isValid(data)) throw new PersistentMetadataCacheError("INVALID_METADATA_RESPONSE");
    try {
      await input.store.write(input.key, input.source, data);
    } catch {
      throw new PersistentMetadataCacheError("CACHE_WRITE_FAILED");
    }
    return data;
  });
  inFlightMetadata.set(identity, request);
  try {
    return { data: await request, fromCache: false };
  } finally {
    if (inFlightMetadata.get(identity) === request) inFlightMetadata.delete(identity);
  }
}

// Best-effort coalescing inside this Edge isolate. Independent isolates may both see a first miss.
const inFlightMetadata = new Map<string, Promise<unknown>>();
