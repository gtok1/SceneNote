const initials = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const vowels = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const finals = ["", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

/** A conservative fallback for Korean spellings of Japanese names, used only after an empty person search. */
export function romanizeHangulPersonQuery(query: string): string | null {
  const parts = query.trim().split(/\s+/u);
  if (parts.length !== 2 || parts.some(part => !/^[가-힣]{1,5}$/u.test(part))) return null;

  return parts.map(part => [...part].map(syllable => {
    const offset = syllable.charCodeAt(0) - 0xac00;
    const initial = Math.floor(offset / 588);
    const vowel = Math.floor((offset % 588) / 28);
    const final = offset % 28;

    if (initial === 9 && vowel === 20) return `shi${finals[final]}`;
    if (initial === 9 && vowel === 17) return `shu${finals[final]}`;
    if (initial === 14 && vowel === 18) return `tsu${finals[final]}`;
    if (initial === 18 && vowel === 13) return `fu${finals[final]}`;
    return `${initials[initial]}${vowels[vowel]}${finals[final]}`;
  }).join("")).join(" ");
}
