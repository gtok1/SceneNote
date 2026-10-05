export interface ListScrollPosition { offset: number; itemCount: number }

export function getListRestoreOffset(position: ListScrollPosition, contentHeight: number, viewportHeight: number, itemCount: number): number | null {
  if (contentHeight <= 0 || viewportHeight <= 0) return null;
  const maximum = Math.max(0, contentHeight - viewportHeight);
  // Wait for the saved page count before accepting a shorter list as the final layout.
  if (maximum < position.offset && itemCount < position.itemCount) return null;
  return Math.min(Math.max(0, position.offset), maximum);
}
