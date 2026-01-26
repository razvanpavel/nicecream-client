import Constants, { ExecutionEnvironment } from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
  destroy: () => void;
}

// Mock service for Expo Go
const mockAudioService: AudioService = {
  isAvailable: false,
  setup: (): Promise<boolean> => Promise.resolve(false),
  play: (url: string, title: string): Promise<void> => {
    console.log(`[Mock Audio] Would play: ${title} - ${url}`);
    return Promise.resolve();
  },
  pause: (): Promise<void> => {
    console.log('[Mock Audio] Would pause');
    return Promise.resolve();
  },
  stop: (): Promise<void> => {
    console.log('[Mock Audio] Would stop');
    return Promise.resolve();
  },
  togglePlayback: (): Promise<boolean> => {
    console.log('[Mock Audio] Would toggle playback');
    return Promise.resolve(false);
  },
  destroy: (): void => {
    console.log('[Mock Audio] Would destroy');
  },
};

// Real service using TrackPlayer
const createRealAudioService = async (): Promise<AudioService> => {
  const TrackPlayer = await import('react-native-track-player');
  const { default: TP, State, Capability, AppKilledPlaybackBehavior, RepeatMode } = TrackPlayer;

  let isSetup = false;
  // P0 Fix: Setup promise deduplication
  let setupPromise: Promise<boolean> | null = null;
  // Request ID to prevent race conditions during rapid stream switching
  let currentPlayRequestId = 0;

  return {
    isAvailable: true,

    setup: async (): Promise<boolean> => {
      // Return existing setup promise if in progress
      if (setupPromise !== null) {
        return setupPromise;
      }

      if (isSetup) {
        return true;
      }

      setupPromise = (async (): Promise<boolean> => {
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
      })();

      try {
        return await setupPromise;
      } finally {
        setupPromise = null;
      }
    },

    play: async (url: string, title: string): Promise<void> => {
      const thisRequestId = ++currentPlayRequestId;

      // Check current state and pause gracefully if playing
      const currentState = await TP.getPlaybackState();

      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      if (currentState.state === State.Playing || currentState.state === State.Buffering) {
        await TP.pause();
        // Delay to allow audio hardware to flush buffers
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      // Stop completely before reset to ensure clean state
      await TP.stop();
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      // Reset queue
      await TP.reset();
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      // Add new track and play
      await TP.add({
        id: 'live-stream',
        url,
        title,
        artist: 'Nicecream.fm',
        artwork: 'https://nicecream.fm/icon.png',
        isLiveStream: true,
      });

      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      await TP.play();
    },

    pause: async (): Promise<void> => {
      await TP.pause();
    },

    stop: async (): Promise<void> => {
      await TP.stop();
    },

    togglePlayback: async (): Promise<boolean> => {
      const state = await TP.getPlaybackState();
      if (state.state === State.Playing) {
        await TP.pause();
        return false;
      } else {
        await TP.play();
        return true;
      }
    },

    destroy: (): void => {
      // Reset the player on destroy
      void TP.reset();
      isSetup = false;
      setupPromise = null;
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
