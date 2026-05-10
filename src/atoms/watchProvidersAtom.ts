import { atom } from "jotai";

import type { WatchProvidersResponse } from "@/types/watchProviders";

export interface WatchProvidersAtomState {
  itemsByKey: Record<string, WatchProvidersResponse>;
  loadingByKey: Record<string, boolean>;
  errorByKey: Record<string, string | null>;
}

export const watchProvidersAtom = atom<WatchProvidersAtomState>({
  itemsByKey: {},
  loadingByKey: {},
  errorByKey: {}
});
