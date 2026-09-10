/**
 * SceneNote stores all pin positions as integer seconds in DB.
 * UI accepts and displays MM:SS or HH:MM:SS. For digits-only input,
 * the UX policy treats the last two digits as seconds, the previous two
 * as minutes, and any leading digits as hours:
 *   Short numbers are interpreted as raw seconds, so "90" becomes 90 seconds
 *   and normalizes to "01:30".
 *   "1230" -> "12:30"
 *   "10230" -> "1:02:30"
 */

export function parseTimecodeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      return Number.parseInt(trimmed, 10);
    }
    const seconds = Number(trimmed.slice(-2));
    const minutes = Number(trimmed.slice(-4, -2));
    const hours = trimmed.length > 4 ? Number(trimmed.slice(0, -4)) : 0;
    const total = hours * 3600 + minutes * 60 + seconds;
    return seconds < 60 && (trimmed.length <= 4 || minutes < 60) && Number.isSafeInteger(total) ? total : null;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.some((part) => !/^\d+$/.test(part))) return null;

  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) return null;

  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    if (minutes === undefined || seconds === undefined || seconds >= 60) return null;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numbers;
  if (
    hours === undefined ||
    minutes === undefined ||
    seconds === undefined ||
    minutes >= 60 ||
    seconds >= 60
  ) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export type TimecodeInputState =
  | { kind: "empty"; seconds: null }
  | { kind: "valid"; seconds: number }
  | { kind: "invalid_nonempty"; seconds: null };

export function classifyTimecodeInput(input: string): TimecodeInputState {
  if (input.trim() === "") return { kind: "empty", seconds: null };
  const seconds = parseTimecodeToSeconds(input);
  return seconds === null
    ? { kind: "invalid_nonempty", seconds: null }
    : { kind: "valid", seconds };
}

export function formatSecondsToTimecode(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));

  if (normalized >= 3600) {
    const hours = Math.floor(normalized / 3600);
    const minutes = Math.floor((normalized % 3600) / 60);
    const remainingSeconds = normalized % 60;
    return `${hours}:${pad2(minutes)}:${pad2(remainingSeconds)}`;
  }

  const minutes = Math.floor(normalized / 60);
  const remainingSeconds = normalized % 60;
  return `${pad2(minutes)}:${pad2(remainingSeconds)}`;
}

export function normalizeTimecodeInput(input: string): string {
  const seconds = parseTimecodeToSeconds(input);
  return seconds === null ? input : formatSecondsToTimecode(seconds);
}

export function isTimeWithinEpisode(
  seconds: number,
  episodeDurationSeconds?: number | null
): boolean {
  if (!Number.isFinite(seconds) || seconds < 0) return false;
  if (!episodeDurationSeconds || episodeDurationSeconds <= 0) return true;
  return seconds <= episodeDurationSeconds;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Preserve editing text; normalize only after the original has passed validation. */
export function resolveTimecodeInput(raw: string, phase: "change" | "blur" | "save") {
  const state = classifyTimecodeInput(raw);
  return {
    ...state,
    text: phase !== "change" && state.kind === "valid" ? formatSecondsToTimecode(state.seconds) : raw
  };
}
