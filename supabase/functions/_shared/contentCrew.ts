export type CrewRole = "director" | "writer" | "original" | "creator";

export interface CrewMemberMeta {
  id: number;
  name: string;
  original_name: string | null;
  role: CrewRole;
  job: string;
  profile_url: string | null;
}

export const CREW_ROLE_LIMIT = 3;
export const CREW_TOTAL_LIMIT = 12;

export interface TmdbCrewInput {
  id?: number;
  name?: string | null;
  original_name?: string | null;
  job?: string | null;
  profile_path?: string | null;
}

export interface TmdbCreatorInput {
  id?: number;
  name?: string | null;
  original_name?: string | null;
  profile_path?: string | null;
}

export interface AniListStaffEdgeInput {
  role?: string | null;
  node?: {
    id?: number;
    name?: { full?: string | null; native?: string | null } | null;
    image?: { large?: string | null; medium?: string | null } | null;
  } | null;
}

const ROLE_ORDER: CrewRole[] = ["director", "writer", "original", "creator"];

export function parseStoredCrew(value: unknown): CrewMemberMeta[] {
  if (!Array.isArray(value)) return [];
  const members: CrewMemberMeta[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const member = candidate as Record<string, unknown>;
    if (typeof member.id !== "number" || !Number.isFinite(member.id) ||
        typeof member.name !== "string" || !member.name.trim() ||
        !ROLE_ORDER.includes(member.role as CrewRole)) continue;
    members.push({
      id: member.id, name: member.name.trim(), role: member.role as CrewRole,
      job: typeof member.job === "string" ? member.job : "",
      original_name: typeof member.original_name === "string" ? member.original_name : null,
      profile_url: typeof member.profile_url === "string" ? member.profile_url : null
    });
  }
  return collectCrew(members).slice(0, CREW_TOTAL_LIMIT);
}

export function serializeCrewForStorage(crew: readonly CrewMemberMeta[] | null | undefined): CrewMemberMeta[] {
  return parseStoredCrew(crew);
}
const TMDB_JOBS: Record<Exclude<CrewRole, "creator">, readonly string[]> = {
  director: ["Director", "Series Director"],
  writer: ["Writer", "Screenplay", "Teleplay", "Story", "Head Writer", "Adaptation", "Series Composition"],
  original: ["Novel", "Original Story", "Comic Book", "Author", "Graphic Novel", "Book", "Original Concept"]
};
const ANILIST_ROLES: Record<Exclude<CrewRole, "creator">, readonly string[]> = {
  director: ["director", "chief director", "series director"],
  writer: ["series composition", "script", "screenplay", "scenario"],
  original: ["original creator", "original story", "original work"]
};

function matchRole(value: string, roles: typeof TMDB_JOBS): CrewRole | undefined {
  return ROLE_ORDER.find((role) => role !== "creator" && roles[role].includes(value));
}

function collectCrew(members: CrewMemberMeta[]): CrewMemberMeta[] {
  return ROLE_ORDER.flatMap((role) => {
    const ids = new Set<number>();
    return members.filter((member) => {
      if (member.role !== role || ids.has(member.id)) return false;
      ids.add(member.id);
      return true;
    }).slice(0, CREW_ROLE_LIMIT);
  });
}

export function mapTmdbCrew(
  crew: readonly TmdbCrewInput[] | undefined,
  createdBy?: readonly TmdbCreatorInput[] | undefined
): CrewMemberMeta[] {
  const members: CrewMemberMeta[] = [];
  for (const member of crew ?? []) {
    const job = member.job?.trim() ?? "";
    const role = matchRole(job, TMDB_JOBS);
    const name = member.name?.trim();
    if (!role || typeof member.id !== "number" || !name) continue;
    members.push({
      id: member.id, name, original_name: member.original_name?.trim() || null, role, job,
      profile_url: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : null
    });
  }
  if (!members.some((member) => member.role === "director" || member.role === "writer")) {
    for (const member of createdBy ?? []) {
      const name = member.name?.trim();
      if (typeof member.id !== "number" || !name) continue;
      members.push({
        id: member.id, name, original_name: member.original_name?.trim() || null,
        role: "creator", job: "Creator",
        profile_url: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : null
      });
    }
  }
  return collectCrew(members);
}

export function mapAniListStaff(edges: readonly AniListStaffEdgeInput[] | undefined): CrewMemberMeta[] {
  const members: CrewMemberMeta[] = [];
  for (const edge of edges ?? []) {
    const job = edge.role?.trim() ?? "";
    const role = matchRole(job.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase(), ANILIST_ROLES);
    const member = edge.node;
    const name = member?.name?.native?.trim() || member?.name?.full?.trim();
    if (!role || typeof member?.id !== "number" || !name) continue;
    members.push({
      id: member.id, name, original_name: member.name?.full?.trim() || null, role, job,
      profile_url: member.image?.large ?? member.image?.medium ?? null
    });
  }
  return collectCrew(members);
}
