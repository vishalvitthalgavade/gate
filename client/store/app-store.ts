import { create } from "zustand";

type AppState = {
  apiHealthy: boolean | null;
  setApiHealthy: (value: boolean | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  apiHealthy: null,
  setApiHealthy: (apiHealthy) => set({ apiHealthy }),
}));
