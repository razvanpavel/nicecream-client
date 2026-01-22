import TrackPlayer, { State, type Track } from 'react-native-track-player';
import { create } from 'zustand';

interface StreamMetadata {
  title?: string;
  artist?: string;
}

interface AudioState {
  isPlaying: boolean;
  currentTrack: Track | null;
  streamMetadata: StreamMetadata | null;

  // Actions
  playIcecastStream: (url: string, stationName: string) => Promise<void>;
  playMP3: (url: string, title: string, artist: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  setStreamMetadata: (metadata: StreamMetadata) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isPlaying: false,
  currentTrack: null,
  streamMetadata: null,

  playIcecastStream: async (url: string, stationName: string): Promise<void> => {
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: 'icecast-stream',
      url,
      title: stationName,
      artist: 'Live Stream',
      isLiveStream: true,
    });
    await TrackPlayer.play();
    set({ isPlaying: true });
  },

  playMP3: async (url: string, title: string, artist: string): Promise<void> => {
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: url,
      url,
      title,
      artist,
    });
    await TrackPlayer.play();
    set({ isPlaying: true });
  },

  togglePlayback: async (): Promise<void> => {
    const state = await TrackPlayer.getPlaybackState();
    if (state.state === State.Playing) {
      await TrackPlayer.pause();
      set({ isPlaying: false });
    } else {
      await TrackPlayer.play();
      set({ isPlaying: true });
    }
  },

  stop: async (): Promise<void> => {
    await TrackPlayer.stop();
    set({ isPlaying: false, currentTrack: null });
  },

  setStreamMetadata: (metadata: StreamMetadata): void => {
    set({ streamMetadata: metadata });
  },
}));
