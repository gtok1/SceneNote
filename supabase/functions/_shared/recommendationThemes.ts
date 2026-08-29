export type ContentThemeFamily =
  | "relationship"
  | "tone"
  | "setting"
  | "narrative"
  | "occupation"
  | "audience"
  | "format";

export interface SourceContentTag {
  name: string;
  source: string;
  rank?: number | null;
}

export interface ContentTheme {
  family: ContentThemeFamily;
  key: string;
  label: string;
  centrality: number;
  source: string;
  source_key: string;
}

// Niche gating stays stricter than user-facing actions: genre-derived themes are
// useful explicit feedback targets, but should not become diversity keys by default.
export const NICHE_THEME_CENTRALITY_THRESHOLD = 0.4;
export const USER_ACTIONABLE_THEME_CENTRALITY_THRESHOLD = 0.3;

export function isUserActionableTheme(theme: Pick<ContentTheme, "centrality">): boolean {
  return theme.centrality >= USER_ACTIONABLE_THEME_CENTRALITY_THRESHOLD;
}

interface ThemeDefinition {
  family: ContentThemeFamily;
  key: string;
  label: string;
  aliases: readonly string[];
}

// Only provider tags with a concrete narrative meaning belong here. Broad genres
// stay in the genre scorer and never become niche diversity keys.
const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  { family: "relationship", key: "boys-love", label: "BL", aliases: ["boys love", "boy's love", "bl", "yaoi", "male male romance", "male/male romance"] },
  { family: "relationship", key: "girls-love", label: "GL", aliases: ["girls love", "girl's love", "gl", "yuri", "female female romance", "female/female romance"] },
  { family: "relationship", key: "queer-romance", label: "퀴어 로맨스", aliases: ["lgbtq romance", "lgbtq+ romance", "queer romance", "same sex romance", "same-sex romance"] },
  { family: "relationship", key: "workplace-romance", label: "직장 로맨스", aliases: ["workplace romance", "office romance", "직장 로맨스", "오피스 로맨스"] },
  { family: "relationship", key: "school-romance", label: "학원 로맨스", aliases: ["school romance", "high school romance", "학원 로맨스"] },
  { family: "narrative", key: "revenge", label: "복수극", aliases: ["revenge", "revenge story", "복수", "복수극"] },
  { family: "narrative", key: "time-travel", label: "타임슬립", aliases: ["time travel", "time loop", "타임슬립", "시간 여행"] },
  { family: "narrative", key: "survival", label: "생존", aliases: ["survival", "death game", "생존", "데스 게임"] },
  { family: "narrative", key: "investigation", label: "미스터리 수사", aliases: ["detective", "investigation", "mystery investigation", "수사", "추리"] },
  { family: "narrative", key: "coming-of-age", label: "성장", aliases: ["coming of age", "coming-of-age", "성장"] },
  { family: "narrative", key: "psychological", label: "심리전", aliases: ["psychological", "mind games", "심리전"] },
  { family: "setting", key: "school", label: "학원물", aliases: ["school", "school life", "high school", "학원물", "학교"] },
  { family: "setting", key: "military", label: "군대물", aliases: ["military", "army", "군대", "군사"] },
  { family: "setting", key: "dystopia", label: "디스토피아", aliases: ["dystopia", "dystopian", "디스토피아"] },
  { family: "setting", key: "historical-period", label: "시대극", aliases: ["historical", "historical period", "period drama", "시대극"] },
  { family: "setting", key: "other-world", label: "이세계", aliases: ["isekai", "other world", "another world", "이세계"] },
  { family: "occupation", key: "medical", label: "의료물", aliases: ["medical", "medicine", "hospital", "doctor", "의료", "병원"] },
  { family: "occupation", key: "legal", label: "법정물", aliases: ["legal", "lawyer", "courtroom", "법정", "변호사"] },
  { family: "occupation", key: "politics", label: "정치극", aliases: ["politics", "political", "정치"] },
  { family: "occupation", key: "disaster-rescue", label: "재난 구조", aliases: ["disaster", "rescue", "disaster response", "재난", "구조"] },
  { family: "tone", key: "family-comedy", label: "가족 코미디", aliases: ["family comedy", "가족 코미디"] }
];

const THEME_BY_ALIAS = new Map(
  THEME_DEFINITIONS.flatMap((definition) =>
    definition.aliases.map((alias) => [normalizeThemeText(alias), definition] as const)
  )
);

export const BROAD_GENRES = new Set([
  "action", "action adventure", "adventure", "animation", "anime", "comedy", "drama",
  "fantasy", "movie", "romance", "science fiction", "sci fi fantasy", "tv series"
]);

export function normalizeContentThemes(input: {
  external_source?: string | null | undefined;
  genres?: readonly string[] | null | undefined;
  keywords?: readonly string[] | null | undefined;
  source_tags?: readonly SourceContentTag[] | null | undefined;
}): ContentTheme[] {
  const source = input.external_source?.trim() || "unknown";
  const providerTags: SourceContentTag[] = input.source_tags?.length
    ? input.source_tags.map((tag) => ({ ...tag, source: tag.source || source }))
    : (input.keywords ?? []).map((name) => ({ name, source, rank: null }));
  // Specific genres can carry narrative meaning, but are weaker evidence than
  // provider tags. Broad genres remain exclusively in the genre scorer.
  const genreTags: SourceContentTag[] = (input.genres ?? [])
    .filter((genre) => !isBroadGenre(genre))
    .map((name) => ({ name, source: `${source}:genre`, rank: null }));
  const tags = [...providerTags, ...genreTags];
  const themes = new Map<string, ContentTheme>();

  for (const tag of tags) {
    const sourceKey = normalizeThemeText(tag.name);
    const definition = THEME_BY_ALIAS.get(sourceKey);
    if (!definition) continue;
    const centrality = centralityFromTag(tag);
    const mapKey = `${definition.family}:${definition.key}`;
    const previous = themes.get(mapKey);
    if (!previous || previous.centrality < centrality) {
      themes.set(mapKey, {
        family: definition.family,
        key: definition.key,
        label: definition.label,
        centrality,
        source: tag.source,
        source_key: tag.name
      });
    }
  }

  return [...themes.values()].sort((left, right) => right.centrality - left.centrality);
}

export function isBroadGenre(value: string): boolean {
  return BROAD_GENRES.has(normalizeThemeText(value));
}

export function themeIdentity(theme: Pick<ContentTheme, "family" | "key">): string {
  return `${theme.family}:${theme.key}`;
}

function centralityFromTag(tag: SourceContentTag): number {
  if (tag.source.toLocaleLowerCase().endsWith(":genre")) return 0.3;
  if (tag.source.toLocaleLowerCase() === "anilist" && typeof tag.rank === "number" && Number.isFinite(tag.rank)) {
    return round(Math.min(1, Math.max(0.2, tag.rank / 100)));
  }
  // TMDB keywords and other unranked tags prove presence, not prominence.
  return 0.45;
}

function normalizeThemeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’']/gu, "")
    .replace(/[+&/_-]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
