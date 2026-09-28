export const BOTTOM_NAV_MAX_WIDTH = 640;

export function getBottomNavMetrics(windowWidth: number, itemCount: number): { labelFontSize: 10 | 11; iconPillWidth: number } {
  const width = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 375;
  const count = Math.max(1, Math.floor(itemCount));
  const itemWidth = (Math.min(width, BOTTOM_NAV_MAX_WIDTH) - 8) / count;
  return {
    labelFontSize: itemWidth < 60 ? 10 : 11,
    iconPillWidth: Math.max(32, Math.min(56, Math.floor(itemWidth) - 8))
  };
}
