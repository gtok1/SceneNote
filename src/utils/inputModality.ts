export type InputModality = "keyboard" | "pointer";

export const INITIAL_INPUT_MODALITY: InputModality = "pointer";

export function nextInputModality(
  current: InputModality,
  event: { type: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }
): InputModality {
  if (event.type === "keydown") {
    return event.metaKey || event.ctrlKey || event.altKey ? current : "keyboard";
  }
  if (event.type === "pointerdown" || event.type === "mousedown" || event.type === "touchstart") {
    return "pointer";
  }
  return current;
}
