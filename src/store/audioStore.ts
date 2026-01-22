import { create } from 'zustand';

interface StreamMetadata {
  title?: string;
  artist?: string;
}

interface AudioState {
  isPlaying: boolean;
  currentStreamUrl: string | null;
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
  streamMetadata: null,
  isTrackPlayerAvailable: false,

  playIcecastStream: async (url: string, stationName: string): Promise<void> => {
    const { isTrackPlayerAvailable, currentStreamUrl } = get();

    // Don't restart if already playing this stream
    if (currentStreamUrl === url) {
      return;
    }

    if (!isTrackPlayerAvailable) {
      console.log(`Would play: ${stationName} - ${url}`);
      set({ currentStreamUrl: url, isPlaying: true });
      return;
    }

    try {
      const TrackPlayer = await import('react-native-track-player');
      await TrackPlayer.default.reset();
      await TrackPlayer.default.add({
        id: 'icecast-stream',
        url,
        title: stationName,
        artist: 'Live Stream',
        isLiveStream: true,
      });
      await TrackPlayer.default.play();
      set({ isPlaying: true, currentStreamUrl: url });
    } catch (error) {
      console.log('Failed to play stream:', error);
      set({ currentStreamUrl: url, isPlaying: true });
    }
  },

  togglePlayback: async (): Promise<void> => {
    const { isTrackPlayerAvailable, isPlaying } = get();

    if (!isTrackPlayerAvailable) {
      set({ isPlaying: !isPlaying });
      return;
    }

    try {
      const TrackPlayer = await import('react-native-track-player');
      const { State } = TrackPlayer;
      const state = await TrackPlayer.default.getPlaybackState();
      if (state.state === State.Playing) {
        await TrackPlayer.default.pause();
        set({ isPlaying: false });
      } else {
        await TrackPlayer.default.play();
        set({ isPlaying: true });
      }
    } catch (error) {
      console.log('Failed to toggle playback:', error);
      set({ isPlaying: !isPlaying });
    }
  },

  stop: async (): Promise<void> => {
    const { isTrackPlayerAvailable } = get();

    if (!isTrackPlayerAvailable) {
      set({ isPlaying: false, currentStreamUrl: null });
      return;
    }

    try {
      const TrackPlayer = await import('react-native-track-player');
      await TrackPlayer.default.stop();
      set({ isPlaying: false, currentStreamUrl: null });
    } catch (error) {
      console.log('Failed to stop playback:', error);
      set({ isPlaying: false, currentStreamUrl: null });
    }
  },

  setStreamMetadata: (metadata: StreamMetadata): void => {
    set({ streamMetadata: metadata });
  },

  setTrackPlayerAvailable: (available: boolean): void => {
    set({ isTrackPlayerAvailable: available });
  },
}));
