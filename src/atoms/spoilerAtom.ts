import { atom } from "jotai";

export const revealedSpoilerPinIdsAtom = atom<Set<string>>(new Set<string>());
