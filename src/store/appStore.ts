import { create } from 'zustand';

export type ChannelId = 'red' | 'green' | 'blue';

interface AppState {
  currentStreamIndex: number;
  isPlayerSetup: boolean;
  isOffline: boolean;
  isHomeVisible: boolean;
  hasHomeDismissed: boolean;
  isHomeFullyHidden: boolean;
  pendingNavigation: 'prev' | 'next' | null;

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
  currentStreamIndex: 1, // Default to green (center)
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
    set({ pendingNavigation: direction });
  },

  clearPendingNavigation: (): void => {
    set({ pendingNavigation: null });
  },
}));
