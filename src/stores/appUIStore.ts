import { create } from "zustand";

export interface AppToast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface AppUIState {
  toasts: AppToast[];
  addToast: (message: string, type?: AppToast["type"]) => void;
  removeToast: (id: string) => void;
}

export const useAppUIStore = create<AppUIState>((set) => ({
  toasts: [],
  addToast: (message, type = "info") =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          message,
          type
        }
      ]
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
}));
