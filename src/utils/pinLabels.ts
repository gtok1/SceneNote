import type { TimelinePin } from "../types/pins";

export function formatPinEpisodeLabel(
  pin: Pick<TimelinePin, "season_number" | "episode_number" | "episode_title">,
  options?: { includeTitle?: boolean }
): string | null {
  const parts: string[] = [];
  if (pin.season_number === 0) parts.push("특별편");
  else if (pin.season_number != null && pin.season_number >= 2) parts.push(`시즌 ${pin.season_number}`);
  const episodeParts: string[] = [];
  if (pin.episode_number != null && Number.isInteger(pin.episode_number) && pin.episode_number >= 1) {
    episodeParts.push(`${pin.episode_number}화`);
  }
  const title = pin.episode_title?.trim();
  if (options?.includeTitle !== false && title) episodeParts.push(title);
  if (!episodeParts.length) return null;
  return [...parts, ...episodeParts].join(" · ");
}
