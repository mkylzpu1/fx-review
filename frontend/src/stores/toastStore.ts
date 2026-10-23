import { create } from "zustand";

export type ToastKind = "success" | "info" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** 「取り消す」など */
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** どこからでも呼べるトースト表示 */
export const toast = {
  success: (message: string, action?: ToastItem["action"]) =>
    useToastStore.getState().push({ kind: "success", message, action }),
  info: (message: string) =>
    useToastStore.getState().push({ kind: "info", message }),
  error: (message: string) =>
    useToastStore.getState().push({ kind: "error", message }),
};
