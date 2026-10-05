import { create } from "zustand";
import type { ListScrollPosition } from "@/utils/listScrollPosition";

interface ListScrollState {
  positions: Record<string, ListScrollPosition>;
  save: (scope: string, position: ListScrollPosition) => void;
}

// Session-only UI state: never restore another account's or filter's scroll position.
export const useListScrollStore = create<ListScrollState>((set) => ({
  positions: {},
  save: (scope, position) => set(state => {
    const entries = Object.entries(state.positions).filter(([key]) => key !== scope).slice(-19);
    return { positions: { ...Object.fromEntries(entries), [scope]: position } };
  })
}));

export function getSavedListPosition(scope: string): ListScrollPosition {
  return useListScrollStore.getState().positions[scope] ?? { offset: 0, itemCount: 0 };
}
