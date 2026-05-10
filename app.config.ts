import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SceneNote",
  slug: "scenenote",
  scheme: "scenenote",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.scenenote.app"
  },
  android: {
    package: "com.scenenote.app"
  },
  web: {
    bundler: "metro",
    output: "static"
  },
  plugins: ["expo-router", "expo-secure-store"],
  experiments: {
    typedRoutes: true
  }
};

export default config;
