import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useIsFocused } from "@react-navigation/native";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { getSavedListPosition, useListScrollStore } from "@/stores/listScrollStore";
import { getListRestoreOffset } from "@/utils/listScrollPosition";

interface ScrollableList { scrollToOffset: (params: { offset: number; animated: boolean }) => void }

export function useListScrollRestoration(scope: string, listRef: RefObject<ScrollableList | null>, itemCount: number) {
  const focused = useIsFocused();
  const pending = useRef(true);
  const restoredOffset = useRef<number | null>(null);
  const target = useRef(getSavedListPosition(scope));
  const size = useRef({ height: 0, viewport: 0 });
  const frame = useRef<number | null>(null);
  const restore = useCallback(() => {
    if (!focused || !pending.current || !listRef.current) return;
    const offset = getListRestoreOffset(target.current, size.current.height, size.current.viewport, itemCount);
    if (offset === null) return;
    restoredOffset.current = offset;
    listRef.current.scrollToOffset({ offset, animated: false });
    pending.current = false;
  }, [focused, itemCount, listRef]);
  const scheduleRestore = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { frame.current = null; restore(); });
  }, [restore]);

  useLayoutEffect(() => {
    pending.current = true;
    restoredOffset.current = null;
    target.current = getSavedListPosition(scope);
  }, [scope, focused]);
  useEffect(() => {
    scheduleRestore();
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [scheduleRestore, scope]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): boolean => {
    if (!focused || pending.current) return false;
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    if (restoredOffset.current !== null) {
      const programmatic = Math.abs(offset - restoredOffset.current) <= 2;
      restoredOffset.current = null;
      if (programmatic) return false;
    }
    useListScrollStore.getState().save(scope, { offset, itemCount });
    return true;
  };
  return {
    onScroll,
    onScrollBeginDrag: () => { pending.current = false; },
    onLoad: scheduleRestore,
    onLayout: (event: LayoutChangeEvent) => { size.current.viewport = event.nativeEvent.layout.height; scheduleRestore(); },
    onContentSizeChange: (_width: number, height: number) => { size.current.height = height; scheduleRestore(); }
  };
}
