export const HOME_CONTENT_MAX_WIDTH = 1200;

export interface HomeLayout {
  gutter: number;
  contentWidth: number;
  posterColumns: number;
  posterGap: number;
  posterWidth: number;
  pinColumns: number;
  pinWidth: number;
  continueLimit: number;
  railTileWidth: number;
}

export function getHomeLayout(width: number): HomeLayout {
  const w = Number.isFinite(width) && width > 0 ? width : 375;
  const mobile = w < 600;
  const gutter = mobile ? 16 : 24;
  const posterGap = mobile ? 12 : 16;
  const posterColumns = mobile ? 3 : w < 960 ? 4 : w < 1280 ? 5 : 6;
  const pinColumns = mobile ? 1 : w < 960 ? 2 : 3;
  const contentWidth = Math.min(w, HOME_CONTENT_MAX_WIDTH) - gutter * 2;

  return {
    gutter,
    contentWidth,
    posterColumns,
    posterGap,
    posterWidth: Math.floor((contentWidth - posterGap * (posterColumns - 1)) / posterColumns),
    pinColumns,
    pinWidth: Math.floor((contentWidth - posterGap * (pinColumns - 1)) / pinColumns),
    continueLimit: posterColumns * (mobile ? 2 : 1),
    railTileWidth: mobile ? 120 : 148,
  };
}
