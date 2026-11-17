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

interface SharedLibraryRowIdentity {
  id: string;
  content_id: string;
  season_number?: number | null;
}

/** New shares preserve registration order. Legacy shares expand every scope deterministically. */
export function selectSharedLibraryRows<T extends SharedLibraryRowIdentity>(
  rows: readonly T[],
  libraryItemIds: readonly string[] | null,
  contentIds: readonly string[]
): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
  if (libraryItemIds !== null) {
    return [...new Set(libraryItemIds)].flatMap(id => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }
  const uniqueRows = [...byId.values()];
  return [...new Set(contentIds)].flatMap(contentId => uniqueRows
    .filter(row => row.content_id === contentId)
    .sort((left, right) => (left.season_number ?? -1) - (right.season_number ?? -1) || left.id.localeCompare(right.id)));
}

interface SharedSeasonMetadata {
  season_number: number;
  episode_count: number | null;
  title?: string | null;
  air_year?: number | null;
}

/** A selected season never borrows the whole-series episode total or another season's title. */
export function sharedSeasonSummary(
  item: { title_primary: string; air_year: number | null; season_number?: number | null },
  seasons: readonly SharedSeasonMetadata[]
): { title_primary: string; episode_count: number | null; air_year: number | null } {
  if (typeof item.season_number !== "number") {
    return {
      title_primary: item.title_primary,
      episode_count: seasons.reduce((sum, season) => sum + (season.episode_count ?? 0), 0) || null,
      air_year: item.air_year
    };
  }
  const season = seasons.find(candidate => candidate.season_number === item.season_number);
  const seasonTitle = season?.title?.trim();
  const meaningfulTitle = seasonTitle && !/^(?:시즌|season)\s*\d+$/i.test(seasonTitle) ? seasonTitle : null;
  return {
    title_primary: meaningfulTitle ?? `${item.title_primary} 시즌 ${item.season_number}`,
    episode_count: season?.episode_count ?? null,
    air_year: season?.air_year ?? item.air_year
  };
}
