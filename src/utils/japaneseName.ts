import type { KoreanNameSource } from "@/types/people";

import { hasHangul, hasJapaneseScript, romajiToHangul } from "../../supabase/functions/_shared/japaneseReading";

export { hasHangul, hasJapaneseScript, romajiToHangul };

export type PersonReadingStatus = "not_applicable" | "provided" | "estimated" | "user" | "missing";

export interface FormattedPersonName {
  name: string;
  secondaryName: string | null;
  readingStatus: PersonReadingStatus;
  koreanName: string | null;
  nativeName: string | null;
}

function isLatin(value: string): boolean {
  return /^[A-Za-zĀāĪīŪūĒēŌō\s'’.-]+$/.test(value) && /[A-Za-z]/.test(value);
}

export function formatPersonName(person: {
  source: "tmdb" | "anilist";
  name: string;
  original_name: string | null;
  name_ko?: string | null;
  name_ko_source?: KoreanNameSource | null;
}): FormattedPersonName {
  const name = person.name.trim();
  const original = person.original_name?.trim() ?? "";
  const candidates = [name, original].filter(Boolean);

  const japanese = candidates.find((value) => hasJapaneseScript(value) && !hasHangul(value));
  if (!japanese) {
    return {
      name,
      secondaryName: original && original !== name ? original : null,
      readingStatus: "not_applicable",
      koreanName: null,
      nativeName: null
    };
  }

  const stored = person.name_ko?.trim() ?? "";
  if (stored && hasHangul(stored)) {
    const source = person.name_ko_source;
    return {
      name: `${japanese}(${stored})`,
      secondaryName: null,
      readingStatus: source === "user" ? "user" : source === "kana" || source === "romaji" ? "estimated" : "provided",
      koreanName: stored,
      nativeName: japanese
    };
  }

  const provided = candidates.find((value) => hasHangul(value));
  if (provided) {
    return {
      name: `${japanese}(${provided})`,
      secondaryName: null,
      readingStatus: "provided",
      koreanName: provided,
      nativeName: japanese
    };
  }

  const latin = candidates.find((value) => value !== japanese && isLatin(value)) ?? null;
  if (person.source === "anilist" && latin) {
    const converted = romajiToHangul(latin, "given-family");
    if (converted) {
      return {
        name: `${japanese}(${converted})`,
        secondaryName: null,
        readingStatus: "estimated",
        koreanName: converted,
        nativeName: japanese
      };
    }
  }

  return { name: japanese, secondaryName: latin, readingStatus: "missing", koreanName: null, nativeName: japanese };
}
