import type { CrewMember, CrewRole } from "@/types/content";

export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  director: "감독", writer: "작가", original: "원작", creator: "크리에이터"
};
export const CREW_SECTION_TITLE = "제작진";

export function createCrewShortLine(crew: readonly CrewMember[] | null | undefined): { text: string; accessibilityLabel: string } {
  const part = createCrewSummary(crew, 1).parts[0];
  if (!part) return { text: "", accessibilityLabel: "" };
  const text = `${part.label} ${part.names[0]}${part.extra ? ` 외 ${part.extra}명` : ""}`;
  return { text, accessibilityLabel: text };
}

export interface CrewSummary {
  parts: { role: CrewRole; label: string; names: string[]; extra: number }[];
  text: string;
  accessibilityLabel: string;
}

export function createCrewSummary(
  crew: readonly CrewMember[] | null | undefined,
  namesPerRole = 2
): CrewSummary {
  const roles: CrewRole[] = ["director", "writer", "original", "creator"];
  const parts: CrewSummary["parts"] = [];
  for (const role of roles) {
    const allNames = [...new Set((crew ?? [])
      .filter((member) => member.role === role)
      .map((member) => member.name.trim())
      .filter(Boolean))];
    if (!allNames.length) continue;
    const names = allNames.slice(0, namesPerRole);
    parts.push({ role, label: CREW_ROLE_LABELS[role], names, extra: allNames.length - names.length });
  }
  const labels = parts.map(({ label, names, extra }) =>
    `${label} ${names.join(", ")}${extra ? ` 외 ${extra}명` : ""}`);
  return { parts, text: labels.join(" · "), accessibilityLabel: labels.join(", ") };
}
