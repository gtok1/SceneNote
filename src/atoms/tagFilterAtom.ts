import { atom } from "jotai";

export const selectedTagFilterIdsAtom = atom<Set<string>>(new Set<string>());
