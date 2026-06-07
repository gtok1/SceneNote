import * as Linking from "expo-linking";
import { Platform } from "react-native";

export { getAuthLinkSession, type AuthLinkSession } from "./authLinkSession";

export function getAuthRedirectUrl(path: `/${string}`) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }

  return Linking.createURL(path);
}
