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
    return parseTimecodeToSeconds(normalizeTimecodeInput(trimmed));
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
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.includes(":")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length <= 2) {
    return formatSecondsToTimecode(Number.parseInt(digits, 10));
  }

  if (digits.length <= 4) {
    const minutes = digits.slice(0, -2).padStart(2, "0");
    const seconds = digits.slice(-2);
    return `${minutes}:${seconds}`;
  }

  const hours = digits.slice(0, -4);
  const minutes = digits.slice(-4, -2).padStart(2, "0");
  const seconds = digits.slice(-2);
  return `${hours}:${minutes}:${seconds}`;
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
