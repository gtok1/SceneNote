import { create } from "zustand";

import type { EmotionType } from "@/types/pins";

interface PinComposerState {
  timestampSeconds: number | null;
  timecodeInput: string;
  memo: string;
  tagNames: string[];
  emotion: EmotionType | null;
  isSpoiler: boolean;
  setTimestamp: (seconds: number | null, input: string) => void;
  setMemo: (memo: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setEmotion: (emotion: EmotionType | null) => void;
  setSpoiler: (isSpoiler: boolean) => void;
  reset: () => void;
}

const initialState = {
  timestampSeconds: null,
  timecodeInput: "",
  memo: "",
  tagNames: [] as string[],
  emotion: null,
  isSpoiler: false
};

export const usePinComposerStore = create<PinComposerState>((set) => ({
  ...initialState,
  setTimestamp: (timestampSeconds, timecodeInput) => set({ timestampSeconds, timecodeInput }),
  setMemo: (memo) => set({ memo }),
  addTag: (tag) =>
    set((state) => {
      const normalized = tag.trim();
      if (!normalized || state.tagNames.includes(normalized) || state.tagNames.length >= 10) {
        return state;
      }
      return { tagNames: [...state.tagNames, normalized] };
    }),
  removeTag: (tag) =>
    set((state) => ({ tagNames: state.tagNames.filter((item) => item !== tag) })),
  setEmotion: (emotion) => set({ emotion }),
  setSpoiler: (isSpoiler) => set({ isSpoiler }),
  reset: () => set(initialState)
}));
