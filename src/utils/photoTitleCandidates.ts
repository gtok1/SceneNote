const COMMON_NOISE_WORDS = new Set([
  "netflix",
  "disney",
  "watcha",
  "tving",
  "wavve",
  "laftel",
  "prime",
  "video",
  "original",
  "series",
  "season",
  "episode",
  "official",
  "trailer",
  "poster",
  "movie",
  "drama",
  "anime"
]);

export function extractPhotoTitleCandidates(text: string, limit = 6): string[] {
  const seen = new Set<string>();

  return text
    .split(/\r?\n/)
    .flatMap(splitCandidateLine)
    .map(cleanCandidate)
    .filter((candidate) => isLikelyTitle(candidate))
    .filter((candidate) => {
      const key = candidate.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => scoreCandidate(right) - scoreCandidate(left))
    .slice(0, limit);
}

function splitCandidateLine(line: string): string[] {
  return line
    .split(/[|·•]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanCandidate(value: string): string {
  return value
    .replace(/\[[^\]]+\]|\([^)]*\)/g, " ")
    .replace(/(?:시즌|season)\s*\d+/gi, " ")
    .replace(/\b(?:ep|episode)\.?\s*\d+\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s:'!?&.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyTitle(value: string): boolean {
  if (value.length < 2 || value.length > 60) return false;
  if (!/[\p{L}\p{N}]/u.test(value)) return false;

  const normalized = value.toLocaleLowerCase();
  if (COMMON_NOISE_WORDS.has(normalized)) return false;
  if (value.split(/\s+/).every((word) => COMMON_NOISE_WORDS.has(word.toLocaleLowerCase()))) return false;
  if (/^\d+$/.test(value)) return false;

  return true;
}

function scoreCandidate(value: string): number {
  const hasKorean = /[가-힣]/.test(value);
  const hasLetters = /\p{L}/u.test(value);
  const lengthScore = Math.max(0, 30 - Math.abs(value.length - 12));
  const wordCount = value.split(/\s+/).length;

  return lengthScore + (hasKorean ? 20 : 0) + (hasLetters ? 8 : 0) - Math.max(0, wordCount - 8) * 4;
}
