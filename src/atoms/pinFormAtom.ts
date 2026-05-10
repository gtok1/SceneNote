import { atom } from "jotai";

import type { EmotionType } from "@/types/pins";

export interface PinFormDraft {
  timecodeDisplay: string;
  timestamp_seconds: number | null;
  memo: string;
  tags: string[];
  emotion: EmotionType;
  is_spoiler: boolean;
}

export const initialPinFormDraft: PinFormDraft = {
  timecodeDisplay: "",
  timestamp_seconds: null,
  memo: "",
  tags: [],
  emotion: "none",
  is_spoiler: false
};

export const pinFormDraftAtom = atom<PinFormDraft>(initialPinFormDraft);
