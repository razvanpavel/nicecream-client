import Constants, { ExecutionEnvironment } from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string, signal?: AbortSignal) => Promise<void>;
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
  console.log('[AudioService] Creating real audio service...');
  const TrackPlayer = await import('react-native-track-player');
  const {
    default: TP,
    State,
    Capability,
    AppKilledPlaybackBehavior,
    RepeatMode,
    IOSCategory,
    IOSCategoryMode,
    IOSCategoryOptions,
  } = TrackPlayer;

  let isSetup = false;
  // P0 Fix: Setup promise deduplication
  let setupPromise: Promise<boolean> | null = null;
  // Fallback request ID for direct play() calls without AbortSignal
  let currentPlayRequestId = 0;

  // Extract setup logic so it can be called from play()
  const doSetup = async (): Promise<boolean> => {
    // Return existing setup promise if in progress
    if (setupPromise !== null) {
      console.log('[AudioService] Setup already in progress, returning existing promise');
      return setupPromise;
    }

    if (isSetup) {
      console.log('[AudioService] Already setup');
      return true;
    }

    console.log('[AudioService] Starting setup...');

    setupPromise = (async (): Promise<boolean> => {
      try {
        // Check if already setup
        const existingTrack = await TP.getActiveTrack();
        console.log('[AudioService] Player already initialized, active track:', existingTrack?.id);
        isSetup = true;
      } catch {
        console.log('[AudioService] Player not initialized, calling setupPlayer...');
        // Setup the player
        await TP.setupPlayer({
          // iOS audio session — activates Playback category on cold start
          iosCategory: IOSCategory.Playback,
          iosCategoryMode: IOSCategoryMode.Default,
          iosCategoryOptions: [
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.AllowBluetoothA2DP,
          ],

          // Buffer settings (maxBuffer/playBuffer/backBuffer are Android-only)
          minBuffer: 15,
          maxBuffer: 50,
          playBuffer: 2,
          backBuffer: 0,

          autoHandleInterruptions: true,
        });
        console.log('[AudioService] setupPlayer complete');

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
        console.log('[AudioService] updateOptions complete');

        await TP.setRepeatMode(RepeatMode.Off);
        console.log('[AudioService] setRepeatMode complete');

        // Brief yield to let the native player fully initialize its audio session.
        await new Promise((resolve) => setTimeout(resolve, 100));

        isSetup = true;
        console.log('[AudioService] Setup complete');
      }
      return isSetup;
    })();

    try {
      return await setupPromise;
    } finally {
      setupPromise = null;
    }
  };

  return {
    isAvailable: true,

    setup: doSetup,

    play: async (url: string, title: string, signal?: AbortSignal): Promise<void> => {
      const thisRequestId = ++currentPlayRequestId;
      const t0 = Date.now();
      const elapsed = (): string => `+${String(Date.now() - t0)}ms`;

      console.log(
        `[AudioService] ${elapsed()} play() called — request #${String(thisRequestId)}, url=${url}`
      );

      // Use signal if provided, otherwise fall back to request ID comparison
      const isCancelled = (): boolean =>
        signal !== undefined ? signal.aborted : thisRequestId !== currentPlayRequestId;

      // Ensure TrackPlayer is initialized before attempting playback
      if (!isSetup) {
        console.log(`[AudioService] ${elapsed()} Not setup yet, running doSetup from play()`);
        await doSetup();
        console.log(`[AudioService] ${elapsed()} doSetup resolved`);
      }

      // Check if superseded during setup
      if (isCancelled()) {
        console.log(`[AudioService] ${elapsed()} Play request superseded during setup`);
        return;
      }

      const track = {
        id: 'live-stream',
        url,
        title,
        artist: 'Nicecream.fm',
        artwork: 'https://nicecream.fm/icon.png',
        isLiveStream: true,
      };

      // Check if a track is already loaded (i.e. switching streams, not cold start)
      const activeTrack = await TP.getActiveTrack();

      if (isCancelled()) {
        return;
      }

      if (activeTrack != null) {
        // Stream switch: explicitly clear playWhenReady before load() to prevent
        // it from auto-playing into a broken CoreAudio state. The subsequent
        // play() call will start from Ready — the same reliable path as cold start.
        console.log(
          `[AudioService] ${elapsed()} Stream switch — calling setPlayWhenReady(false)...`
        );
        await TP.setPlayWhenReady(false);
        console.log(`[AudioService] ${elapsed()} setPlayWhenReady done, calling load()...`);
        await TP.load(track);
        console.log(`[AudioService] ${elapsed()} load() resolved`);
      } else {
        // Cold start: no track loaded yet, use add()
        console.log(`[AudioService] ${elapsed()} Cold start — calling add()...`);
        await TP.add(track);
        console.log(`[AudioService] ${elapsed()} add() resolved`);
      }

      if (isCancelled()) {
        return;
      }

      // Wait for the player to reach Ready before calling play().
      // Calling play() while still Loading/Buffering can put CoreAudio into a
      // broken Playing state with no audio output. Waiting for Ready ensures
      // CoreAudio's pipeline is fully initialized.
      const PLAY_TIMEOUT = 10000;
      let lastLoggedState = '';

      console.log(`[AudioService] ${elapsed()} Waiting for Ready state before playing...`);
      while (Date.now() - t0 < PLAY_TIMEOUT) {
        if (isCancelled()) {
          return;
        }

        const state = await TP.getPlaybackState();
        const currentState = state.state as string;

        if (currentState !== lastLoggedState) {
          console.log(`[AudioService] ${elapsed()} State: ${currentState}`);
          lastLoggedState = currentState;
        }

        if (state.state === State.Ready) {
          console.log(`[AudioService] ${elapsed()} Ready — calling TP.play()...`);
          break;
        }

        if (state.state === State.Error) {
          console.error(`[AudioService] ${elapsed()} Playback entered error state during load`);
          throw new Error('Playback failed to start');
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await TP.play();
      console.log(`[AudioService] ${elapsed()} TP.play() resolved`);

      // Confirm Playing state with retry on Ready (play() can fail to stick).
      let playRetries = 0;
      const MAX_PLAY_RETRIES = 5;

      while (Date.now() - t0 < PLAY_TIMEOUT) {
        if (isCancelled()) {
          return;
        }

        const state = await TP.getPlaybackState();

        if (state.state === State.Playing) {
          console.log(
            `[AudioService] ${elapsed()} Playback confirmed (retries: ${String(playRetries)})`
          );
          return;
        }

        if (state.state === State.Error) {
          console.error(`[AudioService] ${elapsed()} Playback entered error state`);
          throw new Error('Playback failed to start');
        }

        if (state.state === State.Ready && playRetries < MAX_PLAY_RETRIES) {
          playRetries++;
          console.log(
            `[AudioService] ${elapsed()} State is Ready — re-issuing TP.play() (attempt ${String(playRetries)})`
          );
          await TP.play();
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const finalState = await TP.getPlaybackState();
      console.error(`[AudioService] ${elapsed()} Playback timeout. Final state:`, finalState.state);
      throw new Error('Playback start timeout');
    },

    pause: async (): Promise<void> => {
      console.log('[AudioService] pause() called');
      await TP.pause();
    },

    stop: async (): Promise<void> => {
      console.log('[AudioService] stop() called');
      await TP.stop();
    },

    togglePlayback: async (): Promise<boolean> => {
      const state = await TP.getPlaybackState();
      console.log('[AudioService] togglePlayback(), current state:', state.state);
      if (state.state === State.Playing) {
        await TP.pause();
        return false;
      } else {
        await TP.play();
        return true;
      }
    },

    destroy: (): void => {
      console.log('[AudioService] destroy() called');
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
    // Initialize TrackPlayer before returning
    await audioServiceInstance.setup();
    return audioServiceInstance;
  } catch (error) {
    console.log('Failed to initialize audio service:', error);
    audioServiceInstance = mockAudioService;
    return mockAudioService;
  }
}

export { isExpoGo };
