import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

import { INITIAL_INPUT_MODALITY, nextInputModality, type InputModality } from "@/utils/inputModality";

export function useInputModality(): () => InputModality {
  const modality = useRef<InputModality>(INITIAL_INPUT_MODALITY);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const events = ["keydown", "pointerdown", "mousedown", "touchstart"] as const;
    const updateModality = (event: Event) => {
      modality.current = nextInputModality(modality.current, event);
    };
    for (const type of events) document.addEventListener(type, updateModality, true);
    return () => {
      for (const type of events) document.removeEventListener(type, updateModality, true);
    };
  }, []);

  return useCallback(() => Platform.OS === "web" ? modality.current : INITIAL_INPUT_MODALITY, []);
}
