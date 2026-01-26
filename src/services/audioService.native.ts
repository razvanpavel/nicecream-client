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
  const { default: TP, State, Capability, AppKilledPlaybackBehavior, RepeatMode } = TrackPlayer;

  let isSetup = false;

  return {
    isAvailable: true,

    setup: async () => {
      if (isSetup) return true;

      try {
        // Check if already setup
        await TP.getActiveTrack();
        isSetup = true;
      } catch {
        // Setup the player
        await TP.setupPlayer({
          // Buffer settings for streaming
          minBuffer: 15,
          maxBuffer: 50,
          playBuffer: 2,
          backBuffer: 0,
        });

        // Configure player options for background playback
        await TP.updateOptions({
          // Android-specific: Keep playing when app is killed
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
          },

          // Capabilities shown in notification and lock screen
          capabilities: [Capability.Play, Capability.Pause, Capability.Stop],

          // Compact notification capabilities (Android)
          compactCapabilities: [Capability.Play, Capability.Pause],

          // Notification configuration
          notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],

          // Progress bar in notification (disabled for live streams)
          progressUpdateEventInterval: 0,
        });

        await TP.setRepeatMode(RepeatMode.Off);
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
        artist: 'Nicecream.fm',
        artwork: 'https://nicecream.fm/icon.png', // Add your app icon URL
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
