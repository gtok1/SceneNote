import { supabase } from "@/lib/supabase";
import type {
  FavoritePerson,
  KoreanNameSource,
  PersonCategory,
  PersonContentSearchResponse,
  PersonDetail,
  PersonSearchResult,
  PersonSource
} from "@/types/people";
import { romanizeHangulPersonQuery } from "@/utils/personNameRomanization";

export async function searchPersonContent(query: string, category: PersonCategory | "all" = "all") {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return { people: [], results: [], failedSources: [], query: normalizedQuery } satisfies PersonContentSearchResponse;
  }

  const { data, error } = await supabase.functions.invoke<PersonContentSearchResponse>("search-person-content", {
    body: { query: normalizedQuery, category }
  });

  if (error) throw new Error(error.message);
  const primary = data ?? { people: [], results: [], failedSources: [], query: normalizedQuery };
  const romanizedQuery = romanizeHangulPersonQuery(normalizedQuery);
  const hasActor = primary.people.some(person => person.category === "actor");
  if (!romanizedQuery || (category === "all" ? hasActor : primary.people.some(person => person.category === category))) return primary;

  // TMDB often has a Japanese actor's Latin alias but no Korean alternate name.
  // A failed fallback must not discard a successful primary search.
  try {
    const { data: fallback, error: fallbackError } = await supabase.functions.invoke<PersonContentSearchResponse>("search-person-content", {
      body: { query: romanizedQuery, category: category === "all" ? "actor" : category }
    });
    if (fallbackError || !fallback) return primary;
    return {
      people: [...primary.people, ...fallback.people],
      results: [...primary.results, ...fallback.results],
      failedSources: [...new Set([...primary.failedSources, ...fallback.failedSources])],
      query: normalizedQuery
    };
  } catch {
    return primary;
  }
}

export async function getPersonDetail(params: {
  source: PersonSource;
  externalId: string;
  category: PersonCategory;
}): Promise<PersonDetail> {
  const { data, error } = await supabase.functions.invoke<PersonDetail>("get-person-detail", {
    body: {
      source: params.source,
      external_id: params.externalId,
      category: params.category
    }
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("인물 상세 응답이 비어 있습니다");
  if (data.category !== params.category) {
    void updateFavoritePersonCategoryByExternalId(data.source, data.external_id, data.category);
  }
  return data;
}

export async function getFavoritePeople(): Promise<FavoritePerson[]> {
  const { data, error } = await ((supabase as never as { from: (table: string) => unknown }).from("favorite_people") as {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  })
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const people = (data ?? []) as FavoritePerson[];
  const correctedPeople = await Promise.all(people.map(correctFavoritePersonCategory));
  return correctedPeople;
}

type FavoritePeopleTable = { from: (table: string) => unknown };
type DbError = { message: string; code?: string };

// 마이그레이션 0023 이전 DB에는 name_ko 칸이 없어 PostgREST가 PGRST204를 돌려준다.
const MISSING_COLUMN_ERROR_CODE = "PGRST204";

export async function addFavoritePerson(person: PersonSearchResult): Promise<FavoritePerson> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("로그인이 필요합니다");

  const row: Record<string, unknown> = {
    user_id: user.id,
    source: person.source,
    external_id: person.external_id,
    category: person.category,
    name: person.name,
    original_name: person.original_name,
    profile_url: person.profile_url,
    known_for: person.known_for
  };

  const upsert = async (payload: Record<string, unknown>) =>
    await ((supabase as never as FavoritePeopleTable).from("favorite_people") as {
      upsert: (
        row: Record<string, unknown>,
        options: { onConflict: string }
      ) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown | null; error: DbError | null }>;
        };
      };
    })
      .upsert(payload, { onConflict: "user_id,source,external_id" })
      .select("*")
      .single();

  const withKoreanName = person.name_ko
    ? {
        ...row,
        name_ko: person.name_ko,
        name_ko_source: person.name_ko_source ?? null,
        name_ko_checked_at: new Date().toISOString()
      }
    : row;

  let result = await upsert(withKoreanName);
  if (result.error?.code === MISSING_COLUMN_ERROR_CODE && withKoreanName !== row) {
    result = await upsert(row);
  }

  const { data, error } = result;
  if (error) throw new Error(error.message);
  if (!data) throw new Error("좋아하는 인물 저장 응답이 비어 있습니다");
  return data as FavoritePerson;
}

export type ResolvedKoreanName = {
  source: PersonSource;
  external_id: string;
  name_ko: string | null;
  name_ko_source: Exclude<KoreanNameSource, "user"> | null;
};

export async function resolvePersonNames(
  people: Pick<PersonSearchResult, "source" | "external_id">[]
): Promise<ResolvedKoreanName[]> {
  const { data, error } = await supabase.functions.invoke<{ results: ResolvedKoreanName[] }>("resolve-person-names", {
    body: { people: people.map(({ source, external_id }) => ({ source, external_id })) }
  });

  if (error) throw new Error(error.message);
  return data?.results ?? [];
}

// 직접 입력(user) 행은 덮어쓰지 않는다. 마이그레이션 전(PGRST204)에는 조용히 건너뛴다.
export async function applyResolvedKoreanName(
  id: string,
  resolved: Pick<ResolvedKoreanName, "name_ko" | "name_ko_source">
): Promise<void> {
  const { error } = await ((supabase as never as FavoritePeopleTable).from("favorite_people") as {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        or: (filter: string) => Promise<{ error: DbError | null }>;
      };
    };
  })
    .update({
      name_ko_checked_at: new Date().toISOString(),
      ...(resolved.name_ko ? { name_ko: resolved.name_ko, name_ko_source: resolved.name_ko_source } : {})
    })
    .eq("id", id)
    .or("name_ko_source.is.null,name_ko_source.in.(kana,romaji)");

  if (error && error.code !== MISSING_COLUMN_ERROR_CODE) throw new Error(error.message);
}

export async function setFavoriteKoreanName(id: string, nameKo: string | null): Promise<void> {
  const { error } = await ((supabase as never as FavoritePeopleTable).from("favorite_people") as {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: DbError | null }>;
    };
  })
    .update(
      nameKo
        ? { name_ko: nameKo, name_ko_source: "user", name_ko_checked_at: new Date().toISOString() }
        : { name_ko: null, name_ko_source: null, name_ko_checked_at: null }
    )
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteFavoritePerson(id: string): Promise<void> {
  const { error } = await ((supabase as never as { from: (table: string) => unknown }).from("favorite_people") as {
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  })
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

async function correctFavoritePersonCategory(person: FavoritePerson): Promise<FavoritePerson> {
  if (person.category === "voice_actor" || person.source === "anilist") {
    return person.category === "voice_actor" ? person : updateFavoritePersonCategory(person, "voice_actor");
  }

  if (looksLikeVoiceActorFavorite(person)) {
    return updateFavoritePersonCategory(person, "voice_actor");
  }

  return person;
}

function looksLikeVoiceActorFavorite(person: FavoritePerson): boolean {
  const text = [person.name, person.original_name, ...person.known_for].join(" ").toLowerCase();
  const animeHints = [
    "anime",
    "ポケットモンスター",
    "나루토",
    "건방진 천사",
    "주술회전",
    "귀멸",
    "포켓몬",
    "드래곤볼",
    "원피스",
    "명탐정 코난"
  ];

  return animeHints.some((hint) => text.includes(hint.toLowerCase()));
}

async function updateFavoritePersonCategory(
  person: FavoritePerson,
  category: PersonCategory
): Promise<FavoritePerson> {
  const { data, error } = await ((supabase as never as { from: (table: string) => unknown }).from("favorite_people") as {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .update({ category })
    .eq("id", person.id)
    .select("*")
    .single();

  if (error || !data) return { ...person, category };
  return data as FavoritePerson;
}

async function updateFavoritePersonCategoryByExternalId(
  source: PersonSource,
  externalId: string,
  category: PersonCategory
): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  await ((supabase as never as { from: (table: string) => unknown }).from("favorite_people") as {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  })
    .update({ category })
    .eq("user_id", user.id)
    .eq("source", source)
    .eq("external_id", externalId);
}
