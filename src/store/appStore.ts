import { create } from 'zustand';

import { getDefaultStreamIndex } from '@/config/streams';

export type ChannelId = 'red' | 'green' | 'blue';

interface AppState {
  currentStreamIndex: number;
  isPlayerSetup: boolean;
  isOffline: boolean;
  isHomeVisible: boolean;
  hasHomeDismissed: boolean;
  isHomeFullyHidden: boolean;
  pendingNavigation: { direction: 'prev' | 'next'; seq: number } | null;

  // Actions
  setCurrentStreamIndex: (index: number) => void;
  setPlayerSetup: (isSetup: boolean) => void;
  setOffline: (isOffline: boolean) => void;
  setHomeVisible: (visible: boolean) => void;
  setHomeFullyHidden: (hidden: boolean) => void;
  navigateChannel: (direction: 'prev' | 'next') => void;
  clearPendingNavigation: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStreamIndex: getDefaultStreamIndex(),
  isPlayerSetup: false,
  isOffline: false,
  isHomeVisible: true,
  hasHomeDismissed: false,
  isHomeFullyHidden: false,
  pendingNavigation: null,

  setCurrentStreamIndex: (index: number): void => {
    set({ currentStreamIndex: index });
  },

  setPlayerSetup: (isSetup: boolean): void => {
    set({ isPlayerSetup: isSetup });
  },

  setOffline: (isOffline: boolean): void => {
    set({ isOffline });
  },

  setHomeVisible: (visible: boolean): void => {
    if (!visible) {
      set({ isHomeVisible: false, hasHomeDismissed: true });
    } else {
      set({ isHomeVisible: true, isHomeFullyHidden: false });
    }
  },

  setHomeFullyHidden: (hidden: boolean): void => {
    set({ isHomeFullyHidden: hidden });
  },

  navigateChannel: (direction): void => {
    set((state) => ({
      pendingNavigation: {
        direction,
        seq: (state.pendingNavigation?.seq ?? 0) + 1,
      },
    }));
  },

  clearPendingNavigation: (): void => {
    set({ pendingNavigation: null });
  },
}));
