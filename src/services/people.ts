import { supabase } from "@/lib/supabase";
import type {
  FavoritePerson,
  PersonCategory,
  PersonContentSearchResponse,
  PersonDetail,
  PersonSearchResult,
  PersonSource
} from "@/types/people";

export async function searchPersonContent(query: string, category: PersonCategory | "all" = "all") {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return { people: [], results: [], failedSources: [], query: normalizedQuery } satisfies PersonContentSearchResponse;
  }

  const { data, error } = await supabase.functions.invoke<PersonContentSearchResponse>("search-person-content", {
    body: { query: normalizedQuery, category }
  });

  if (error) throw new Error(error.message);
  return data ?? { people: [], results: [], failedSources: [], query: normalizedQuery };
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

export async function addFavoritePerson(person: PersonSearchResult): Promise<FavoritePerson> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("로그인이 필요합니다");

  const { data, error } = await ((supabase as never as { from: (table: string) => unknown }).from("favorite_people") as {
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string }
    ) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
  })
    .upsert(
      {
        user_id: user.id,
        source: person.source,
        external_id: person.external_id,
        category: person.category,
        name: person.name,
        original_name: person.original_name,
        profile_url: person.profile_url,
        known_for: person.known_for
      },
      { onConflict: "user_id,source,external_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("좋아하는 인물 저장 응답이 비어 있습니다");
  return data as FavoritePerson;
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
