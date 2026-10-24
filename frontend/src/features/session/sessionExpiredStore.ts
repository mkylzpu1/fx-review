import { create } from "zustand";

interface SessionExpiredState {
  open: boolean;
  notify: () => void;
  close: () => void;
}

export const useSessionExpiredStore = create<SessionExpiredState>((set) => ({
  open: false,
  notify: () => set({ open: true }),
  close: () => set({ open: false }),
}));
