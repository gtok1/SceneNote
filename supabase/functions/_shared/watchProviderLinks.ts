export const DISNEY_PLUS_HOME_URL = "https://www.disneyplus.com/ko-kr";

/** Repair obsolete generated search links, including responses from older deployments. */
export function normalizeWatchProviderLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    const isDisney = url.hostname === "www.disneyplus.com" || url.hostname === "disneyplus.com";
    if (isDisney && /^\/(?:[a-z]{2}-[a-z]{2}\/)?(?:browse\/)?search\/?$/i.test(url.pathname)) {
      return DISNEY_PLUS_HOME_URL;
    }
  } catch {
    return null;
  }
  return link;
}
