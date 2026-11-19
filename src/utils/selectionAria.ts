export type SelectionAriaRole = "button" | "radio" | "plain";

export interface SelectionAriaProps {
  "aria-selected"?: boolean;
  "aria-pressed"?: boolean;
  "aria-checked"?: boolean;
}

export function selectionAriaProps(
  role: SelectionAriaRole,
  selected: boolean,
  os: string,
  options?: { current?: boolean }
): SelectionAriaProps {
  if (os === "web") {
    if (role === "button") {
      return options?.current === true ? {} : { "aria-pressed": selected };
    }
    return role === "radio" ? { "aria-checked": selected } : {};
  }

  return role === "radio"
    ? { "aria-selected": selected, "aria-checked": selected }
    : { "aria-selected": selected };
}
