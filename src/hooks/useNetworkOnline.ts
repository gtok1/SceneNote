import { useEffect, useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { Platform } from "react-native";

export function useNetworkOnline() {
  const [online, setOnline] = useState(() => Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.onLine : onlineManager.isOnline());
  useEffect(() => {
    const unsubscribe = onlineManager.subscribe(setOnline);
    if (Platform.OS !== "web") {
      let active = true;
      const updateNative = (state: Network.NetworkState) => {
        if (!active) return;
        const connected = state.isConnected !== false && state.isInternetReachable !== false;
        onlineManager.setOnline(connected); setOnline(connected);
      };
      void Network.getNetworkStateAsync().then(updateNative).catch(() => undefined);
      const subscription = Network.addNetworkStateListener(updateNative);
      return () => { active = false; subscription.remove(); unsubscribe(); };
    }
    const update = () => { onlineManager.setOnline(navigator.onLine); setOnline(navigator.onLine); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { unsubscribe(); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}
