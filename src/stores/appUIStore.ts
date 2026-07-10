import { create } from "zustand";

const TOAST_DURATION_MS = 3_500;

export interface AppToast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  actionLabel?: string;
  onAction?: () => void;
}

interface AppUIState {
  toasts: AppToast[];
  addToast: (
    message: string,
    type?: AppToast["type"],
    options?: { actionLabel?: string; durationMs?: number; onAction?: () => void }
  ) => void;
  removeToast: (id: string) => void;
}

export const useAppUIStore = create<AppUIState>((set, get) => ({
  toasts: [],
  addToast: (message, type = "info", options) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: AppToast = {
      id,
      message,
      type,
      ...(options?.actionLabel ? { actionLabel: options.actionLabel } : {}),
      ...(options?.onAction ? { onAction: options.onAction } : {})
    };

    set((state) => ({
      toasts: [...state.toasts, toast]
    }));

    setTimeout(() => {
      get().removeToast(id);
    }, options?.durationMs ?? TOAST_DURATION_MS);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
}));
