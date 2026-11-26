import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

interface FeedbackState {
  toasts: ToastItem[];
  pendingConfirm: PendingConfirm | null;
  pushToast: (type: ToastType, message: string, durationMs?: number) => void;
  dismissToast: (id: string) => void;
  openConfirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toasts: [],
  pendingConfirm: null,

  pushToast: (type, message, durationMs = 3200) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, type, message }],
    }));
    if (durationMs > 0 && typeof window !== "undefined") {
      setTimeout(() => {
        get().dismissToast(id);
      }, durationMs);
    }
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  openConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      const prev = get().pendingConfirm;
      if (prev) prev.resolve(false);
      set({
        pendingConfirm: {
          ...options,
          resolve,
        },
      });
    });
  },

  resolveConfirm: (confirmed) => {
    const current = get().pendingConfirm;
    if (current) {
      current.resolve(confirmed);
    }
    set({ pendingConfirm: null });
  },
}));

export const toast = {
  info: (message: string) => useFeedbackStore.getState().pushToast("info", message),
  success: (message: string) => useFeedbackStore.getState().pushToast("success", message),
  warning: (message: string) => useFeedbackStore.getState().pushToast("warning", message),
  error: (message: string) => useFeedbackStore.getState().pushToast("error", message, 4200),
};

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return useFeedbackStore.getState().openConfirm(options);
}
