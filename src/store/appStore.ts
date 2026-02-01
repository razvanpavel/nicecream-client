import { create } from 'zustand';

export type ChannelId = 'red' | 'green' | 'blue';

interface AppState {
  currentStreamIndex: number;
  isPlayerSetup: boolean;
  isOffline: boolean;

  // Actions
  setCurrentStreamIndex: (index: number) => void;
  setPlayerSetup: (isSetup: boolean) => void;
  setOffline: (isOffline: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStreamIndex: 1, // Default to green (center)
  isPlayerSetup: false,
  isOffline: false,

  setCurrentStreamIndex: (index: number): void => {
    set({ currentStreamIndex: index });
  },

  setPlayerSetup: (isSetup: boolean): void => {
    set({ isPlayerSetup: isSetup });
  },

  setOffline: (isOffline: boolean): void => {
    set({ isOffline });
  },
}));
