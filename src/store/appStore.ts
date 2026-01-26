import { create } from 'zustand';

export interface BackgroundImage {
  url: string;
  author: string;
  authorUrl: string;
}

export type ChannelId = 'red' | 'green' | 'blue';

export type ChannelBackgrounds = Record<ChannelId, BackgroundImage | null>;

interface AppState {
  currentStreamIndex: number;
  isPlayerSetup: boolean;

  // Per-channel background state
  channelBackgrounds: ChannelBackgrounds;
  isBackgroundLoading: Record<ChannelId, boolean>;

  // Actions
  setCurrentStreamIndex: (index: number) => void;
  setPlayerSetup: (isSetup: boolean) => void;
  setChannelBackground: (channel: ChannelId, background: BackgroundImage | null) => void;
  setChannelBackgroundLoading: (channel: ChannelId, loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStreamIndex: 1, // Default to green (center)
  isPlayerSetup: false,
  channelBackgrounds: {
    red: null,
    green: null,
    blue: null,
  },
  isBackgroundLoading: {
    red: false,
    green: false,
    blue: false,
  },

  setCurrentStreamIndex: (index: number): void => {
    set({ currentStreamIndex: index });
  },

  setPlayerSetup: (isSetup: boolean): void => {
    set({ isPlayerSetup: isSetup });
  },

  setChannelBackground: (channel: ChannelId, background: BackgroundImage | null): void => {
    set((state) => ({
      channelBackgrounds: {
        ...state.channelBackgrounds,
        [channel]: background,
      },
    }));
  },

  setChannelBackgroundLoading: (channel: ChannelId, loading: boolean): void => {
    set((state) => ({
      isBackgroundLoading: {
        ...state.isBackgroundLoading,
        [channel]: loading,
      },
    }));
  },
}));
