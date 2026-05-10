import type { SearchResult } from "./content";

export type PersonSource = "tmdb" | "anilist";
export type PersonCategory = "actor" | "voice_actor";

export interface PersonSearchResult {
  source: PersonSource;
  external_id: string;
  category: PersonCategory;
  name: string;
  original_name: string | null;
  profile_url: string | null;
  known_for: string[];
}

export interface PersonContentSearchResponse {
  people: PersonSearchResult[];
  results: SearchResult[];
  failedSources: string[];
  query: string;
}

export interface PersonCredit {
  external_source: "tmdb" | "anilist";
  external_id: string;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  content_type: "anime" | "kdrama" | "jdrama" | "movie" | "other";
  air_year: number | null;
  role: string | null;
}

export interface PersonDetail {
  source: PersonSource;
  external_id: string;
  category: PersonCategory;
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
  credits: PersonCredit[];
}

export interface FavoritePerson extends PersonSearchResult {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}
