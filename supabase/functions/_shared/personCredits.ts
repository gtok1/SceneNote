export interface TmdbPersonCredit {
  id: number;
  media_type?: string | null;
  genre_ids?: number[] | null;
  character?: string | null;
  popularity?: number | null;
  vote_count?: number | null;
}

export const EXCLUDED_PERSON_CREDIT_GENRE_IDS: readonly number[] = [10763, 10764, 10767];

export function isSelfAppearance(character: string | null | undefined): boolean {
  return Boolean(character && (/(?:^|[^a-z])(?:self|herself|himself|themselves)(?:[^a-z]|$)/i.test(character) || character.includes("본인")));
}

export function isEligiblePersonCredit(credit: TmdbPersonCredit): boolean {
  return (credit.media_type === "movie" || credit.media_type === "tv") &&
    !(credit.genre_ids ?? []).some(id => EXCLUDED_PERSON_CREDIT_GENRE_IDS.includes(id)) &&
    !isSelfAppearance(credit.character);
}

export function selectPersonCastCredits<T extends TmdbPersonCredit>(cast: readonly T[], limit = 40): T[] {
  const byMedia = new Map<string, T>();
  for (const credit of cast) {
    if (!isEligiblePersonCredit(credit)) continue;
    const key = `${credit.media_type}:${credit.id}`;
    if (!byMedia.has(key)) byMedia.set(key, credit);
  }
  return [...byMedia.values()]
    .sort((left, right) =>
      ((right.popularity ?? 0) + (right.vote_count ?? 0) / 1000) -
      ((left.popularity ?? 0) + (left.vote_count ?? 0) / 1000) || left.id - right.id
    )
    .slice(0, limit);
}
