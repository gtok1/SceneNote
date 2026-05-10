export interface NetflixBulkImportRow {
  [key: string]: string | number | boolean | null;
  work_id: string;
  import_selected: boolean;
  desired_watch_status: string;
  normalized_title: string;
  title_override: string;
  tmdb_search_query: string;
  media_hint: string;
  view_count: number;
  first_watched_date: string;
  last_watched_date: string;
  needs_manual_title_review: boolean;
  review_flag: string;
  sample_titles: string;
  existing_app_content_id: string;
  tmdb_id: string;
  tmdb_media_type: string;
  tmdb_match_status: string;
}

export interface BulkImportSummary {
  total_rows: number;
  selected_rows: number;
  existing_app_matches: number;
  tmdb_cache_hits: number;
  tmdb_api_calls: number;
  tmdb_matched_existing_content: number;
  new_content_to_create: number;
  new_content_created: number;
  status_to_update: number;
  status_updated: number;
  manual_review_required: number;
  skipped: number;
  failed: number;
}

export interface BulkImportRowResult {
  work_id: string;
  row_number: number;
  normalized_title: string;
  resolved_title: string;
  existing_app_content_id: string;
  resolved_tmdb_id: string;
  resolved_media_type: string;
  duplicate_check_result: string;
  import_result: string;
  status_result: string;
  failure_reason: string;
}

export interface BulkImportReport {
  mode: "dry-run" | "commit";
  summary: BulkImportSummary;
  rows: BulkImportRowResult[];
}
