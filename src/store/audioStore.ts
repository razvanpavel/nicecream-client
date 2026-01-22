import { create } from 'zustand';

import { getAudioService, isExpoGo } from '@/services/audioService';

interface StreamMetadata {
  title?: string;
  artist?: string;
}

interface AudioState {
  isPlaying: boolean;
  currentStreamUrl: string | null;
  currentStreamName: string | null;
  streamMetadata: StreamMetadata | null;
  isTrackPlayerAvailable: boolean;

  // Actions
  playIcecastStream: (url: string, stationName: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  setStreamMetadata: (metadata: StreamMetadata) => void;
  setTrackPlayerAvailable: (available: boolean) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  isPlaying: false,
  currentStreamUrl: null,
  currentStreamName: null,
  streamMetadata: null,
  isTrackPlayerAvailable: !isExpoGo,

  playIcecastStream: async (url: string, stationName: string): Promise<void> => {
    const { currentStreamUrl } = get();

    // Don't restart if already playing this stream
    if (currentStreamUrl === url) {
      return;
    }

    set({ currentStreamUrl: url, currentStreamName: stationName });

    if (isExpoGo) {
      console.log(`[Expo Go] Would play: ${stationName}`);
      set({ isPlaying: true });
      return;
    }

    try {
      const audioService = await getAudioService();
      await audioService.play(url, stationName);
      set({ isPlaying: true });
    } catch (error) {
      console.log('Failed to play stream:', error);
      set({ isPlaying: true }); // Still update UI state
    }
  },

  togglePlayback: async (): Promise<void> => {
    const { isPlaying } = get();

    if (isExpoGo) {
      set({ isPlaying: !isPlaying });
      return;
    }

    try {
      const audioService = await getAudioService();
      const nowPlaying = await audioService.togglePlayback();
      set({ isPlaying: nowPlaying });
    } catch (error) {
      console.log('Failed to toggle playback:', error);
      set({ isPlaying: !isPlaying });
    }
  },

  stop: async (): Promise<void> => {
    if (isExpoGo) {
      set({ isPlaying: false, currentStreamUrl: null, currentStreamName: null });
      return;
    }

    try {
      const audioService = await getAudioService();
      await audioService.stop();
      set({ isPlaying: false, currentStreamUrl: null, currentStreamName: null });
    } catch (error) {
      console.log('Failed to stop playback:', error);
      set({ isPlaying: false, currentStreamUrl: null, currentStreamName: null });
    }
  },

  setStreamMetadata: (metadata: StreamMetadata): void => {
    set({ streamMetadata: metadata });
  },

  setTrackPlayerAvailable: (available: boolean): void => {
    set({ isTrackPlayerAvailable: available });
  },
}));
