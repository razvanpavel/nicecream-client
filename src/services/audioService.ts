import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
}

// Mock service for Expo Go
const mockAudioService: AudioService = {
  isAvailable: false,
  setup: async () => false,
  play: async (url, title) => {
    console.log(`[Mock Audio] Would play: ${title} - ${url}`);
  },
  pause: async () => {
    console.log('[Mock Audio] Would pause');
  },
  stop: async () => {
    console.log('[Mock Audio] Would stop');
  },
  togglePlayback: async () => {
    console.log('[Mock Audio] Would toggle playback');
    return false;
  },
};

// Real service using TrackPlayer
const createRealAudioService = async (): Promise<AudioService> => {
  const TrackPlayer = await import('react-native-track-player');
  const {
    default: TP,
    State,
    Capability,
    AppKilledPlaybackBehavior,
    RepeatMode,
    Event,
  } = TrackPlayer;

  let isSetup = false;

  return {
    isAvailable: true,

    setup: async () => {
      if (isSetup) return true;

      try {
        await TP.getActiveTrack();
        isSetup = true;
      } catch {
        await TP.setupPlayer();
        await TP.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.Stop,
          ],
          compactCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],
        });
        await TP.setRepeatMode(RepeatMode.Off);

        // Register events
        TP.addEventListener(Event.RemotePlay, () => void TP.play());
        TP.addEventListener(Event.RemotePause, () => void TP.pause());
        TP.addEventListener(Event.RemoteStop, () => void TP.stop());

        isSetup = true;
      }
      return isSetup;
    },

    play: async (url, title) => {
      await TP.reset();
      await TP.add({
        id: 'stream',
        url,
        title,
        artist: 'Live Stream',
        isLiveStream: true,
      });
      await TP.play();
    },

    pause: async () => {
      await TP.pause();
    },

    stop: async () => {
      await TP.stop();
    },

    togglePlayback: async () => {
      const state = await TP.getPlaybackState();
      if (state.state === State.Playing) {
        await TP.pause();
        return false;
      } else {
        await TP.play();
        return true;
      }
    },
  };
};

// Export a function that returns the appropriate service
let audioServiceInstance: AudioService | null = null;

export async function getAudioService(): Promise<AudioService> {
  if (audioServiceInstance !== null) {
    return audioServiceInstance;
  }

  if (isExpoGo) {
    console.log('Running in Expo Go - audio playback disabled');
    audioServiceInstance = mockAudioService;
    return mockAudioService;
  }

  try {
    audioServiceInstance = await createRealAudioService();
    return audioServiceInstance;
  } catch (error) {
    console.log('Failed to initialize audio service:', error);
    audioServiceInstance = mockAudioService;
    return mockAudioService;
  }
}

export { isExpoGo };
