import type { TimelinePin } from "@/types/pins";

export function removePinFromCachedValue(value: unknown, pinId: string): unknown {
  if (Array.isArray(value)) return (value as TimelinePin[]).filter((pin) => pin.id !== pinId);
  return (value as TimelinePin | null | undefined)?.id === pinId ? null : value;
}
