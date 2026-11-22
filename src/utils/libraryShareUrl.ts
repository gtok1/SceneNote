const SHARE_ORIGIN_ERROR = "공유 웹 주소가 설정되지 않았어요. 앱 설정을 확인해 주세요.";

function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.includes(":")) return true;
  const parts = hostname.split(".").map(Number);
  if (parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] === 192 && parts[1] === 168 ||
      parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31 || parts[0] === 169 && parts[1] === 254;
  }
  return !hostname.includes(".");
}

export function resolveLibraryShareOrigin(input: {
  platform: string;
  configuredOrigin?: unknown;
  webOrigin?: string | null;
}): string {
  const configured = typeof input.configuredOrigin === "string" ? input.configuredOrigin.trim() : "";
  const candidate = configured || (input.platform === "web" ? input.webOrigin : null);
  if (!candidate) throw new Error(SHARE_ORIGIN_ERROR);
  try {
    const url = new URL(candidate);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error(SHARE_ORIGIN_ERROR);
    if (configured || input.platform !== "web") {
      if (url.protocol !== "https:" || isPrivateHost(url.hostname)) throw new Error(SHARE_ORIGIN_ERROR);
    } else if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(SHARE_ORIGIN_ERROR);
    }
    return url.origin;
  } catch {
    throw new Error(SHARE_ORIGIN_ERROR);
  }
}

export function canBuildLibraryShareUrl(input: { platform: string; configuredOrigin?: unknown }): boolean {
  const configured = typeof input.configuredOrigin === "string" ? input.configuredOrigin.trim() : "";
  if (!configured) return input.platform === "web";
  try {
    resolveLibraryShareOrigin({ platform: input.platform, configuredOrigin: configured });
    return true;
  } catch {
    return false;
  }
}
