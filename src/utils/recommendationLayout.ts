import { getHomeLayout } from "./homeLayout";

export function getResponsiveRecommendationColumns(availableWidth: number, fontScale = 1): number {
  const width = availableWidth / Math.max(1, fontScale);
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 800) return 4;
  if (width >= 600) return 3;
  if (width >= 360) return 2;
  return 1;
}

export function getSearchGalleryLayout(availableWidth: number, fontScale = 1, isWeb = false): {
  columns: number;
  expanded: boolean;
} {
  const width = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : 375;
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? Math.max(1, fontScale) : 1;
  const expanded = isWeb && getHomeLayout(width / scale).posterColumns >= 5;
  return {
    columns: expanded ? 3 : getResponsiveRecommendationColumns(Math.min(width, 1280), scale),
    expanded
  };
}
