import { create } from 'zustand';

import { getAudioService, isExpoGo } from '@/services/audioService';

// Request counter for cancelling stale play requests
let currentPlayRequestId = 0;

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface StreamMetadata {
  title?: string;
  artist?: string;
}

interface AudioState {
  // Playback state
  status: PlaybackStatus;
  currentStreamUrl: string | null;
  currentStreamName: string | null;
  streamMetadata: StreamMetadata | null;
  error: string | null;

  // Feature flags
  isTrackPlayerAvailable: boolean;
  hasUserInteracted: boolean;

  // Actions
  playStream: (url: string, stationName: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  setStreamMetadata: (metadata: StreamMetadata) => void;
  setTrackPlayerAvailable: (available: boolean) => void;
  setUserInteracted: () => void;
  setError: (message: string) => void;
  clearError: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  status: 'idle',
  currentStreamUrl: null,
  currentStreamName: null,
  streamMetadata: null,
  error: null,
  isTrackPlayerAvailable: !isExpoGo,
  hasUserInteracted: false,

  playStream: async (url: string, stationName: string): Promise<void> => {
    const { currentStreamUrl, status } = get();

    // Don't restart if already playing/loading this stream
    if (currentStreamUrl === url && (status === 'playing' || status === 'loading')) {
      return;
    }

    // Increment request ID to cancel any in-flight requests
    const thisRequestId = ++currentPlayRequestId;

    // Update state to loading
    set({
      status: 'loading',
      currentStreamUrl: url,
      currentStreamName: stationName,
      error: null,
      hasUserInteracted: true,
    });

    if (isExpoGo) {
      // Simulate loading delay for Expo Go
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check if this request was superseded
      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      console.log(`[Expo Go] Would play: ${stationName}`);
      set({ status: 'playing' });
      return;
    }

    try {
      const audioService = await getAudioService();
      await audioService.play(url, stationName);

      // Check if this request was superseded
      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      set({ status: 'playing' });
    } catch (error) {
      // Check if this request was superseded
      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to play stream';
      console.error('Failed to play stream:', error);
      set({ status: 'error', error: errorMessage });
    }
  },

  togglePlayback: async (): Promise<void> => {
    const { status, currentStreamUrl, currentStreamName } = get();

    // Mark user interaction
    set({ hasUserInteracted: true });

    // If idle or error with a stream selected, start playing
    if (
      (status === 'idle' || status === 'error') &&
      currentStreamUrl !== null &&
      currentStreamName !== null
    ) {
      await get().playStream(currentStreamUrl, currentStreamName);
      return;
    }

    // If loading, ignore
    if (status === 'loading') {
      return;
    }

    if (isExpoGo) {
      set({ status: status === 'playing' ? 'paused' : 'playing' });
      return;
    }

    try {
      const audioService = await getAudioService();
      const nowPlaying = await audioService.togglePlayback();
      set({ status: nowPlaying ? 'playing' : 'paused' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Playback error';
      console.error('Failed to toggle playback:', error);
      set({ status: 'error', error: errorMessage });
    }
  },

  stop: async (): Promise<void> => {
    if (isExpoGo) {
      set({ status: 'idle', currentStreamUrl: null, currentStreamName: null });
      return;
    }

    try {
      const audioService = await getAudioService();
      await audioService.stop();
      set({ status: 'idle', currentStreamUrl: null, currentStreamName: null });
    } catch (error) {
      console.error('Failed to stop playback:', error);
      set({ status: 'idle', currentStreamUrl: null, currentStreamName: null });
    }
  },

  setStreamMetadata: (metadata: StreamMetadata): void => {
    set({ streamMetadata: metadata });
  },

  setTrackPlayerAvailable: (available: boolean): void => {
    set({ isTrackPlayerAvailable: available });
  },

  setUserInteracted: (): void => {
    set({ hasUserInteracted: true });
  },

  setError: (message: string): void => {
    set({ status: 'error', error: message });
  },

  clearError: (): void => {
    set({ error: null, status: 'idle' });
  },
}));

// Helper selectors
export const selectIsPlaying = (state: AudioState): boolean => state.status === 'playing';
export const selectIsLoading = (state: AudioState): boolean => state.status === 'loading';
export const selectHasError = (state: AudioState): boolean => state.status === 'error';
