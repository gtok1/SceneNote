import { hasHangul, hasJapaneseScript, hasLatin, type KoreanNameInput } from "./japaneseReading.ts";

export interface TmdbPersonNameDetail {
  name?: string | null;
  also_known_as?: string[] | null;
  translations?: {
    translations?: {
      iso_639_1?: string;
      iso_3166_1?: string;
      data?: { name?: string | null } | null;
    }[];
  } | null;
}

function cleanList(values: readonly (string | null | undefined)[] | null | undefined): string[] {
  return (values ?? []).map((value) => value?.trim() ?? "").filter(Boolean);
}

function translationName(detail: TmdbPersonNameDetail, language: string): string | null {
  const match = (detail.translations?.translations ?? []).find(
    (item) => item.iso_639_1 === language && item.data?.name?.trim()
  );
  return match?.data?.name?.trim() || null;
}

export function tmdbKoreanNameInput(detail: TmdbPersonNameDetail): KoreanNameInput {
  const localizedName = detail.name?.trim() || null;
  const aliases = cleanList(detail.also_known_as);

  const nativeName =
    translationName(detail, "ja") ??
    aliases.find((value) => /[㐀-䶿一-鿿]/.test(value) && !hasHangul(value)) ??
    aliases.find((value) => hasJapaneseScript(value)) ??
    (hasJapaneseScript(localizedName) ? localizedName : null);

  const english = translationName(detail, "en");
  const romaji =
    english && hasLatin(english) && !hasJapaneseScript(english) && !hasHangul(english)
      ? { text: english, order: "given-family" as const }
      : null;

  return { nativeName, localizedName, aliases, romaji };
}

export interface AniListStaffName {
  first?: string | null;
  last?: string | null;
  full?: string | null;
  native?: string | null;
  alternative?: (string | null)[] | null;
}

export function anilistKoreanNameInput(name: AniListStaffName | null | undefined): KoreanNameInput {
  const first = name?.first?.trim();
  const last = name?.last?.trim();
  const full = name?.full?.trim();

  const romaji = first && last
    ? { text: `${last} ${first}`, order: "family-given" as const }
    : full
      ? { text: full, order: "given-family" as const }
      : null;

  return {
    nativeName: name?.native?.trim() || null,
    localizedName: null,
    aliases: cleanList(name?.alternative),
    romaji
  };
}
