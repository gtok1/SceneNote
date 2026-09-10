import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle, Platform, View } from "react-native";

const modalStack: symbol[] = [];

/** Native modal isolates accessibility; web additionally traps keyboard focus and restores the trigger. */
export function useModalFocus(visible: boolean) {
  const modalId = useRef(Symbol("modal"));
  const panelRef = useRef<View>(null);
  const firstRef = useRef<View>(null);
  const focusFirst = useCallback(() => {
    if (Platform.OS === "web") (firstRef.current as unknown as HTMLElement | null)?.focus();
    else {
      const handle = findNodeHandle(firstRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, []);
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const id = modalId.current;
    modalStack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(focusFirst, 0);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || modalStack.at(-1) !== id) return;
      const panel = panelRef.current as unknown as HTMLElement | null;
      const items = Array.from(panel?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]') ?? []).filter(el => !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true" && el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => {
      const wasTop = modalStack.at(-1) === id;
      const index = modalStack.indexOf(id);
      if (index >= 0) modalStack.splice(index, 1);
      clearTimeout(timer); document.removeEventListener("keydown", trap);
      if (wasTop && previous?.isConnected) previous.focus();
    };
  }, [visible, focusFirst]);
  return { panelRef, firstRef, focusFirst };
}
