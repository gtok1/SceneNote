export function getResponsiveRecommendationColumns(width: number): number {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 800) return 4;
  if (width >= 600) return 3;
  if (width >= 360) return 2;
  return 1;
}
