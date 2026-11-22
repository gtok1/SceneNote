import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const staticPage = () => false;

// Expo's static HTML has no browser dimensions or URL query string. Only the
// hydration render uses its snapshot. Later navigation can read both immediately.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, clientReady, staticPage);
}
