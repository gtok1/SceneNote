/**
 * Same "is this season name actually meaningful, or just a generic placeholder" check
 * used by the search adapter's expandAiredSeasons/applyTmdbSeasonMetadata, reimplemented
 * client-side so the library list can label season-scoped rows distinctly from the
 * whole-work row for the same content. Without this, a season-2 row shows the exact
 * same title as the whole-work/season-1 row, reading as a duplicate rather than a
 * separate season. See docs/17_season_library_tracking_spec.md D-5.
 */
export function createSeasonDisplayTitle(
  baseTitle: string,
  seasonNumber: number | null | undefined,
  seasonName: string | null | undefined
): string {
  if (typeof seasonNumber !== "number") return baseTitle;

  const trimmed = seasonName?.trim();
  const meaningful = trimmed && !/^(?:시즌|season)\s*\d+$/i.test(trimmed) ? trimmed : null;

  return meaningful ?? `${baseTitle} 시즌 ${seasonNumber}`;
}
