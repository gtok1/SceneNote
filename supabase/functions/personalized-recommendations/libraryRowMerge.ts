interface MergeableLibraryRow {
  content_id?: string | null;
  status?: string | null;
  status_flags?: string[] | null;
  watch_count?: number | null;
  contents?: unknown;
}

/**
 * migration 0021 lets one content have several user_library_items rows (a whole-work row
 * plus one per registered season). buildPreferenceProfile weighs libraryItems one row at
 * a time, so feeding it multiple rows for the same show double-counts that show's
 * genres/people/studios. Collapse to one row per content_id before handing rows to the
 * recommendation engine. See docs/17_season_library_tracking_spec.md 10장.
 */
export function mergeLibraryRowsByContent<T extends MergeableLibraryRow>(rows: readonly T[]): T[] {
  const byContentId = new Map<string, T>();

  for (const row of rows) {
    const contentId = row.content_id ?? "";
    const existing = byContentId.get(contentId);

    if (!existing) {
      byContentId.set(contentId, row);
      continue;
    }

    byContentId.set(contentId, {
      ...existing,
      status_flags: Array.from(new Set([...(existing.status_flags ?? []), ...(row.status_flags ?? [])])),
      // Take the higher count rather than summing, so registering more seasons cannot
      // inflate a show's watch_count artificially.
      watch_count: Math.max(existing.watch_count ?? 0, row.watch_count ?? 0),
      contents: existing.contents ?? row.contents
    });
  }

  return Array.from(byContentId.values());
}
