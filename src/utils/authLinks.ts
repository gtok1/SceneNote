import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { buildAuthRedirectUrl } from "./authRedirect";

export { getAuthLinkSession, type AuthLinkSession } from "./authLinkSession";
export { buildAuthRedirectUrl } from "./authRedirect";

export function getAuthRedirectUrl(path: `/${string}`) {
  const webOrigin = getCurrentWebOrigin();
  if (Platform.OS === "web" && webOrigin) {
    return buildAuthRedirectUrl(path, webOrigin);
  }

  return Linking.createURL(path);
}

function getCurrentWebOrigin() {
  if (typeof window === "undefined") return null;

  const { protocol, host, origin } = window.location;
  if (protocol && host) return `${protocol}//${host}`;
  return origin || null;
}
