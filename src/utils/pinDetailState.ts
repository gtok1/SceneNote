/** Keep the editor mounted until its own delete callback can leave the route. */
export function pinForDetail<T extends { id: string }>(
  current: T | null | undefined,
  lastLoaded: T | null,
  pinId: string,
  isEditing: boolean
): T | null {
  if (current?.id === pinId) return current;
  return isEditing && lastLoaded?.id === pinId ? lastLoaded : null;
}
