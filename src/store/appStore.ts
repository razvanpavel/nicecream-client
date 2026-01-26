import { create } from 'zustand';

export interface BackgroundImage {
  url: string;
  author: string;
  authorUrl: string;
}

interface AppState {
  currentStreamIndex: number;
  isPlayerSetup: boolean;

  // Background state
  backgroundImage: BackgroundImage | null;
  isBackgroundLoading: boolean;

  // Actions
  setCurrentStreamIndex: (index: number) => void;
  setPlayerSetup: (isSetup: boolean) => void;
  setBackgroundImage: (background: BackgroundImage | null) => void;
  setBackgroundLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStreamIndex: 1, // Default to green (center)
  isPlayerSetup: false,
  backgroundImage: null,
  isBackgroundLoading: false,

  setCurrentStreamIndex: (index: number): void => {
    set({ currentStreamIndex: index });
  },

  setPlayerSetup: (isSetup: boolean): void => {
    set({ isPlayerSetup: isSetup });
  },

  setBackgroundImage: (background: BackgroundImage | null): void => {
    set({ backgroundImage: background });
  },

  setBackgroundLoading: (loading: boolean): void => {
    set({ isBackgroundLoading: loading });
  },
}));
