import * as XLSX from "xlsx";

import type { NetflixBulkImportRow } from "@/types/bulkImport";

const SHEET_NAME = "Works_To_Register";

export function parseNetflixBulkWorkbook(arrayBuffer: ArrayBuffer): NetflixBulkImportRow[] {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: false
  });
  const worksheet = workbook.Sheets[SHEET_NAME];
  if (!worksheet) {
    throw new Error(`엑셀에 ${SHEET_NAME} 시트가 없습니다.`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false
  });

  return rows.map(normalizeWorkbookRow);
}

function normalizeWorkbookRow(row: Record<string, unknown>, index: number): NetflixBulkImportRow {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), normalizeCell(value)])
  );

  return {
    ...normalizedRow,
    work_id: readString(normalizedRow.work_id) || String(index + 1),
    import_selected: readBoolean(normalizedRow.import_selected),
    desired_watch_status: readString(normalizedRow.desired_watch_status) || "completed",
    normalized_title: readString(normalizedRow.normalized_title),
    title_override: readString(normalizedRow.title_override),
    tmdb_search_query: readString(normalizedRow.tmdb_search_query),
    media_hint: readString(normalizedRow.media_hint) || "unknown",
    view_count: readInteger(normalizedRow.view_count),
    first_watched_date: readString(normalizedRow.first_watched_date),
    last_watched_date: readString(normalizedRow.last_watched_date),
    needs_manual_title_review: readBoolean(normalizedRow.needs_manual_title_review),
    review_flag: readString(normalizedRow.review_flag),
    sample_titles: readString(normalizedRow.sample_titles),
    existing_app_content_id: readString(normalizedRow.existing_app_content_id),
    tmdb_id: readString(normalizedRow.tmdb_id),
    tmdb_media_type: readString(normalizedRow.tmdb_media_type),
    tmdb_match_status: readString(normalizedRow.tmdb_match_status)
  };
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLocaleLowerCase();
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function readString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = readString(value).toLocaleLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

function readInteger(value: unknown): number {
  const number = Number.parseInt(readString(value), 10);
  return Number.isFinite(number) ? number : 0;
}
