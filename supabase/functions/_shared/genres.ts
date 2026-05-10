import type { createAdminClient } from "./supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export function normalizeGenreNames(genreNames: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(
      genreNames
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name && name.length > 0))
    )
  );
}

export async function upsertGenres(
  adminClient: AdminClient,
  contentId: string,
  genreNames: string[]
): Promise<void> {
  const normalizedNames = normalizeGenreNames(genreNames);
  if (normalizedNames.length === 0) return;

  const { data: genreRows, error: genreError } = await adminClient
    .from("genres")
    .upsert(
      normalizedNames.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: false }
    )
    .select("id,name");

  if (genreError || !genreRows) {
    console.error("upsertGenres - genres upsert failed:", genreError);
    return;
  }

  const { error: joinError } = await adminClient
    .from("content_genres")
    .upsert(
      genreRows.map((genre) => ({
        content_id: contentId,
        genre_id: genre.id
      })),
      { onConflict: "content_id,genre_id", ignoreDuplicates: true }
    );

  if (joinError) {
    console.error("upsertGenres - content_genres upsert failed:", joinError);
  }
}

export function extractGenreNames(
  contentGenres?: { genres?: { name?: string | null } | { name?: string | null }[] | null }[] | null
): string[] {
  return normalizeGenreNames(
    (contentGenres ?? []).flatMap((contentGenre) => {
      const genres = contentGenre.genres;
      if (Array.isArray(genres)) return genres.map((genre) => genre.name);
      return [genres?.name];
    })
  );
}
