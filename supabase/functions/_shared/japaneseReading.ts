export type KoreanNameSource = "user" | "tmdb" | "alias" | "kana" | "romaji";
export type RomajiOrder = "given-family" | "family-given";

export function hasHangul(value: string | null | undefined): boolean {
  return /[가-힣]/.test(value ?? "");
}

export function hasJapaneseScript(value: string | null | undefined): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(value ?? "");
}

export function isKanaOnly(value: string): boolean {
  return /^[぀-ヿー・\s]+$/.test(value) && /[ぁ-ゖァ-ヺ]/.test(value);
}

export function hasLatin(value: string | null | undefined): boolean {
  return /[A-Za-z]/.test(value ?? "");
}

// 관용 표기(TMDB·AniList 한글 표기와 같은 방향): か·た·きゃ·ちゃ행은 위치와 관계없이 거센소리, つ→츠.
// 모음 순서: a i u e o. 빈 문자열은 해당 모음이 없는 칸.
const SYLLABLES: Record<string, readonly string[]> = {
  "": ["아", "이", "우", "에", "오"],
  k: ["카", "키", "쿠", "케", "코"],
  s: ["사", "시", "스", "세", "소"],
  t: ["타", "치", "츠", "테", "토"],
  n: ["나", "니", "누", "네", "노"],
  h: ["하", "히", "후", "헤", "호"],
  f: ["하", "히", "후", "헤", "호"],
  m: ["마", "미", "무", "메", "모"],
  y: ["야", "", "유", "", "요"],
  r: ["라", "리", "루", "레", "로"],
  w: ["와", "", "", "", "오"],
  g: ["가", "기", "구", "게", "고"],
  z: ["자", "지", "즈", "제", "조"],
  d: ["다", "지", "즈", "데", "도"],
  b: ["바", "비", "부", "베", "보"],
  p: ["파", "피", "푸", "페", "포"],
  j: ["자", "지", "주", "제", "조"],
  sh: ["샤", "시", "슈", "셰", "쇼"],
  ch: ["차", "치", "추", "체", "초"],
  ts: ["", "", "츠", "", ""],
  ky: ["캬", "", "큐", "", "쿄"],
  gy: ["갸", "", "규", "", "교"],
  ny: ["냐", "", "뉴", "", "뇨"],
  hy: ["햐", "", "휴", "", "효"],
  my: ["먀", "", "뮤", "", "묘"],
  ry: ["랴", "", "류", "", "료"],
  by: ["뱌", "", "뷰", "", "뵤"],
  py: ["퍄", "", "퓨", "", "표"]
};

// 긴 자음부터 매칭한다. 빈 문자열(모음 단독)은 마지막.
const CONSONANTS = ["sh", "ch", "ts", "ky", "gy", "ny", "hy", "my", "ry", "by", "py", "k", "s", "t", "n", "h", "f", "m", "y", "r", "w", "g", "z", "d", "b", "p", "j", ""];
const VOWELS = "aiueo";
const GEMINATE_CONSONANTS = "kstpgzdbfjh";
const JONG_NIEUN = 4;
const JONG_SIOT = 19;
const MACRONS: Record<string, string> = { ā: "a", ī: "i", ū: "u", ē: "e", ō: "o" };

function addFinal(syllable: string, jong: number): string | null {
  const code = syllable.charCodeAt(0);
  if ((code - 0xac00) % 28 !== 0) return null;
  return String.fromCharCode(code + jong);
}

function convertToken(token: string): string | null {
  const out: string[] = [];
  let index = 0;

  while (index < token.length) {
    const rest = token.slice(index);
    const ch = rest[0] as string;

    if (ch === "'") {
      index += 1;
      continue;
    }

    // ん: n 뒤가 '이거나 모음·y가 아닐 때
    if (ch === "n") {
      const next = rest[1];
      if (next === "'" || !next || !/[aiueoy]/.test(next)) {
        const last = out[out.length - 1];
        const attached = last === undefined ? null : addFinal(last, JONG_NIEUN);
        if (attached === null) return null;
        out[out.length - 1] = attached;
        index += 1;
        continue;
      }
    }

    // っ: 같은 자음 반복 또는 tch
    if ((GEMINATE_CONSONANTS.includes(ch) && rest[1] === ch) || rest.startsWith("tch")) {
      const last = out[out.length - 1];
      const attached = last === undefined ? null : addFinal(last, JONG_SIOT);
      if (attached === null) return null;
      out[out.length - 1] = attached;
      index += 1;
      continue;
    }

    let matched = false;
    for (const consonant of CONSONANTS) {
      if (!rest.startsWith(consonant)) continue;
      const vowel = rest[consonant.length];
      if (!vowel || !VOWELS.includes(vowel)) continue;
      const syllable = SYLLABLES[consonant]?.[VOWELS.indexOf(vowel)];
      if (!syllable) continue;
      out.push(syllable);
      index += consonant.length + 1;
      matched = true;
      break;
    }
    if (!matched) return null;
  }

  return out.length > 0 ? out.join("") : null;
}

export function romajiToHangul(romaji: string, order: RomajiOrder): string | null {
  const normalized = romaji
    .toLowerCase()
    .replace(/[āīūēō]/g, (char) => MACRONS[char] ?? char)
    .replace(/’/g, "'")
    .replace(/uu/g, "u")
    .replace(/oo/g, "o")
    .replace(/aa/g, "a")
    .replace(/ou(?![aiueo])/g, "o")
    .replace(/[^a-z' -]/g, "")
    .trim();

  const tokens = normalized.split(/[\s-]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const converted: string[] = [];
  for (const token of tokens) {
    const hangul = convertToken(token);
    if (!hangul) return null;
    converted.push(hangul);
  }

  if (order === "given-family" && converted.length === 2) converted.reverse();
  return converted.join(" ");
}

const HIRAGANA_ROMAJI: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "i", ゑ: "e", を: "o"
};
const SMALL_Y: Record<string, string> = { ゃ: "a", ゅ: "u", ょ: "o" };

function kanaWordToRomaji(word: string): string | null {
  let result = "";
  let pendingGeminate = false;
  let pendingN = false;
  const chars = Array.from(word);

  for (let index = 0; index < chars.length; index += 1) {
    const ch = chars[index] as string;

    if (ch === "っ") {
      if (pendingGeminate) return null;
      pendingGeminate = true;
      continue;
    }
    if (ch === "ん") {
      if (pendingGeminate) return null;
      if (pendingN) result += "n";
      pendingN = true;
      continue;
    }

    let syllable = HIRAGANA_ROMAJI[ch];
    if (!syllable) return null;

    const small = SMALL_Y[chars[index + 1] ?? ""];
    if (small) {
      if (["shi", "chi", "ji"].includes(syllable)) syllable = syllable.slice(0, -1) + small;
      else if (syllable.length === 2 && syllable.endsWith("i")) syllable = `${syllable[0]}y${small}`;
      else return null;
      index += 1;
    }

    if (pendingN) {
      result += /^[aiueoy]/.test(syllable) ? "n'" : "n";
      pendingN = false;
    }
    if (pendingGeminate) {
      syllable = syllable.startsWith("ch") ? `t${syllable}` : `${syllable[0]}${syllable}`;
      pendingGeminate = false;
    }
    result += syllable;
  }

  if (pendingGeminate) return null;
  if (pendingN) result += "n";
  return result || null;
}

export function kanaToHangul(kana: string): string | null {
  if (!isKanaOnly(kana)) return null;

  const hiragana = kana
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/ー/g, "");

  const words = hiragana.split(/[\s・]+/).filter(Boolean);
  if (words.length === 0) return null;

  const romaji: string[] = [];
  for (const word of words) {
    const converted = kanaWordToRomaji(word);
    if (!converted) return null;
    romaji.push(converted);
  }

  return romajiToHangul(romaji.join(" "), "family-given");
}

export interface KoreanNameInput {
  nativeName: string | null;
  localizedName?: string | null;
  aliases?: readonly string[];
  romaji?: { text: string; order: RomajiOrder } | null;
}

export function resolveKoreanName(
  input: KoreanNameInput
): { nameKo: string; source: Exclude<KoreanNameSource, "user"> } | null {
  const localizedName = input.localizedName?.trim() ?? "";
  const aliases = input.aliases ?? [];

  if (!hasJapaneseScript(input.nativeName) && !hasJapaneseScript(localizedName)) return null;

  if (hasHangul(localizedName) && !hasJapaneseScript(localizedName)) {
    return { nameKo: localizedName, source: "tmdb" };
  }

  const alias = aliases.find((value) => hasHangul(value) && !hasJapaneseScript(value) && !hasLatin(value));
  if (alias) return { nameKo: alias.trim(), source: "alias" };

  for (const value of aliases) {
    if (!isKanaOnly(value) || !/[\s・]/.test(value.trim())) continue;
    const converted = kanaToHangul(value.trim());
    if (converted) return { nameKo: converted, source: "kana" };
  }

  if (input.romaji) {
    const converted = romajiToHangul(input.romaji.text, input.romaji.order);
    if (converted) return { nameKo: converted, source: "romaji" };
  }

  for (const value of aliases) {
    if (!isKanaOnly(value)) continue;
    const converted = kanaToHangul(value.trim());
    if (converted) return { nameKo: converted, source: "kana" };
  }

  return null;
}
