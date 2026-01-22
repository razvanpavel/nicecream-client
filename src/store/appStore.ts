import { create } from 'zustand';

interface AppState {
  currentStreamIndex: number;
  isPlayerSetup: boolean;

  // Actions
  setCurrentStreamIndex: (index: number) => void;
  setPlayerSetup: (isSetup: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStreamIndex: 1, // Default to green (center)
  isPlayerSetup: false,

  setCurrentStreamIndex: (index: number): void => {
    set({ currentStreamIndex: index });
  },

  setPlayerSetup: (isSetup: boolean): void => {
    set({ isPlayerSetup: isSetup });
  },
}));
