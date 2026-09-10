import type { PinFormDraft } from "../atoms/pinFormAtom";
import { resolveTimecodeInput } from "./timecode";
export function isPinDraftDirty(current: PinFormDraft, initial: PinFormDraft, pendingTag: string): boolean {
  const comparable = (draft: PinFormDraft) => ({
    time: resolveTimecodeInput(draft.timecodeDisplay, "save").text,
    memo: draft.memo, tags: draft.tags, emotion: draft.emotion, spoiler: draft.is_spoiler
  });
  return Boolean(pendingTag) || JSON.stringify(comparable(current)) !== JSON.stringify(comparable(initial));
}
