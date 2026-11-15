import type { KoreanNameSource } from "./japaneseReading.ts";

export interface StoredPersonCredit {
  external_source: "tmdb" | "anilist";
  external_id: string;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  content_type: "anime" | "kdrama" | "jdrama" | "movie" | "other";
  air_year: number | null;
  air_date: string | null;
  role: string | null;
}

export interface StoredPersonDetail {
  source: "tmdb" | "anilist";
  external_id: string;
  category: "actor" | "voice_actor";
  name: string;
  original_name: string | null;
  native_name?: string | null;
  profile_url: string | null;
  birthday: string | null;
  deathday?: string | null;
  age: number | null;
  birthplace: string | null;
  gender?: string | null;
  biography: string | null;
  credits: StoredPersonCredit[];
  name_ko: string | null;
  name_ko_source: Exclude<KoreanNameSource, "user"> | null;
}

export function createPersonMetadataKey(source: string, externalId: string, category: string): string {
  // The fallback category affects people with insufficient credits; it belongs in the identity.
  return JSON.stringify(["person-detail-manual-v1", source, externalId, category, "ko-KR"]);
}

export function isStoredPersonDetail(value: unknown, source: string, externalId: string): value is StoredPersonDetail {
  if (!isRecord(value) || value.source !== source || value.external_id !== externalId ||
    !["actor", "voice_actor"].includes(String(value.category)) || typeof value.name !== "string" ||
    !["original_name", "profile_url", "birthday", "birthplace", "biography", "name_ko"].every(key => isNullableText(value[key])) ||
    !["native_name", "deathday", "gender"].every(key => value[key] === undefined || isNullableText(value[key])) ||
    !(value.age === null || (typeof value.age === "number" && Number.isFinite(value.age))) ||
    ![null, "tmdb", "alias", "kana", "romaji"].includes(value.name_ko_source as string | null) ||
    !Array.isArray(value.credits)) return false;
  return value.credits.every(credit => isRecord(credit) &&
    ["tmdb", "anilist"].includes(String(credit.external_source)) && typeof credit.external_id === "string" &&
    credit.external_id.length > 0 && typeof credit.title === "string" &&
    ["anime", "kdrama", "jdrama", "movie", "other"].includes(String(credit.content_type)) &&
    ["original_title", "poster_url", "air_date", "role"].every(key => isNullableText(credit[key])) &&
    (credit.air_year === null || (typeof credit.air_year === "number" && Number.isInteger(credit.air_year))));
}

/** Age is derived at read time, so reusing a saved biography does not freeze the person's age. */
export function calculateStoredPersonAge(birthday?: string | null, deathday?: string | null, now = new Date()): number | null {
  const birth = parseDate(birthday);
  const end = deathday ? parseDate(deathday) : now;
  if (!birth || !end || !Number.isFinite(end.getTime())) return null;
  let age = end.getUTCFullYear() - birth.getUTCFullYear();
  if (end.getUTCMonth() < birth.getUTCMonth() ||
    (end.getUTCMonth() === birth.getUTCMonth() && end.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

function parseDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNullableText(value: unknown): boolean { return value === null || typeof value === "string"; }
