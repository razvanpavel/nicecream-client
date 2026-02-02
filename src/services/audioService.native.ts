import Constants, { ExecutionEnvironment } from 'expo-constants';

// Check if running in Expo Go - must be checked BEFORE any native module imports
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string, signal?: AbortSignal) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
  destroy: () => void;
  // Enhanced lifecycle management methods
  getPlaybackState: () => Promise<string>;
  verifyPlayback: () => Promise<boolean>;
  reconnectStream: () => Promise<void>;
  // Live stream control
  seekToLive: () => Promise<void>;
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
  getPlaybackState: (): Promise<string> => Promise.resolve('idle'),
  verifyPlayback: (): Promise<boolean> => Promise.resolve(true),
  reconnectStream: (): Promise<void> => Promise.resolve(),
  seekToLive: (): Promise<void> => {
    console.log('[Mock Audio] Would seek to live');
    return Promise.resolve();
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
  // Track the last known good stream URL for reconnection
  let lastStreamUrl: string | null = null;
  let lastStreamTitle: string | null = null;

  // Helper: Wait for a specific state with timeout
  const waitForState = async (
    targetState: (typeof State)[keyof typeof State],
    timeoutMs: number
  ): Promise<boolean> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const state = await TP.getPlaybackState();
      if (state.state === targetState) {
        return true;
      }
      if (state.state === State.Error) {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  };

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

        // =======================================================================
        // iOS Audio Session Configuration
        // =======================================================================
        // Category: Playback
        //   - Allows background audio playback
        //   - Audio continues when screen is locked
        //   - Audio continues when app is backgrounded
        //   - Silences other apps (exclusive audio)
        //
        // Mode: Default
        //   - Standard playback mode for music/audio streaming
        //   - No special processing (voice chat, measurement, etc.)
        //
        // Options:
        //   - AllowAirPlay: Enables streaming to AirPlay devices
        //   - AllowBluetoothA2DP: Enables high-quality stereo Bluetooth
        //     (A2DP = Advanced Audio Distribution Profile)
        //
        // NOT using:
        //   - MixWithOthers: Would allow other apps to play simultaneously
        //     (not appropriate for a dedicated radio app)
        //   - DuckOthers: Would lower other audio instead of stopping it
        //     (not needed - we're the primary audio source)
        //   - InterruptSpokenAudioAndMixWithOthers: For apps that briefly interrupt
        //     (not appropriate for continuous streaming)
        // =======================================================================

        await TP.setupPlayer({
          // iOS audio session configuration
          iosCategory: IOSCategory.Playback,
          iosCategoryMode: IOSCategoryMode.Default,
          iosCategoryOptions: [
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.AllowBluetoothA2DP,
          ],

          // =======================================================================
          // Buffer Configuration (Android ExoPlayer settings)
          // =======================================================================
          // minBuffer: Minimum buffer before playback starts (seconds)
          //   - Higher = longer initial load, more resilient to network hiccups
          //   - 15s is a good balance for live streaming
          minBuffer: 15,

          // maxBuffer: Maximum buffer size (seconds)
          //   - For live streams, we don't need huge buffers
          //   - 50s provides good resilience without wasting memory
          maxBuffer: 50,

          // playBuffer: Buffer required to resume after rebuffer (seconds)
          //   - Lower = faster resume after network issues
          //   - 2s allows quick recovery
          playBuffer: 2,

          // backBuffer: Cached audio behind playhead (seconds)
          //   - 0 for live streams (no seeking backwards needed)
          backBuffer: 0,

          // =======================================================================
          // Audio Interruption Handling
          // =======================================================================
          // DISABLED: We handle interruptions manually in playbackService.native.ts
          // via the RemoteDuck event. This gives us full control over the
          // wasPlayingBeforeDuck smart resume logic.
          //
          // If autoHandleInterruptions is true, TrackPlayer automatically pauses/resumes
          // on interruption, which can conflict with our manual handling and cause:
          // - Double pause (pause twice, resume once = stuck paused)
          // - Race conditions between automatic and manual handling
          //
          // With manual control, we can:
          // - Track wasPlayingBeforeDuck state accurately
          // - Decide when to resume vs stay paused after interruption
          // - Handle permanent vs temporary audio focus loss differently
          // =======================================================================
          autoHandleInterruptions: false,
        });
        console.log('[AudioService] setupPlayer complete');

        // =======================================================================
        // Player Options for Background Playback & Notifications
        // =======================================================================

        await TP.updateOptions({
          // Android-specific background playback behavior
          android: {
            // ContinuePlayback: Keep playing when app is removed from recents
            // This creates a foreground service that survives app termination
            // Alternatives:
            //   - StopPlaybackAndRemoveNotification: Stop when app killed
            //   - PausePlayback: Pause but keep notification
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,

            // Pause when another app takes audio focus (phone calls, etc.)
            // This ensures we don't fight for audio with other apps
            alwaysPauseOnInterruption: true,
          },

          // Media controls shown on lock screen and notification
          // We only show Play/Pause/Stop since live streams don't support seek
          capabilities: [Capability.Play, Capability.Pause, Capability.Stop],

          // Compact notification on Android (limited space)
          compactCapabilities: [Capability.Play, Capability.Pause],

          // Full notification capabilities
          notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],

          // Progress bar update interval (0 = disabled for live streams)
          // Live streams don't have meaningful progress to display
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

      // Store for potential reconnection
      lastStreamUrl = url;
      lastStreamTitle = title;

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
        console.log(`[AudioService] ${elapsed()} Cancelled after load, cleaning up`);
        await TP.setPlayWhenReady(false);
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
          console.log(`[AudioService] ${elapsed()} Cancelled during Ready wait, cleaning up`);
          await TP.setPlayWhenReady(false);
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
          console.log(`[AudioService] ${elapsed()} Cancelled during Playing confirm, cleaning up`);
          await TP.setPlayWhenReady(false);
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

    // Enhanced togglePlayback with state confirmation
    togglePlayback: async (): Promise<boolean> => {
      const state = await TP.getPlaybackState();
      console.log('[AudioService] togglePlayback(), current state:', state.state);

      if (state.state === State.Playing) {
        // Pausing - straightforward
        await TP.pause();
        // Confirm pause state
        const confirmed = await waitForState(State.Paused, 2000);
        if (!confirmed) {
          console.warn('[AudioService] Pause state not confirmed, checking current state');
          const currentState = await TP.getPlaybackState();
          return currentState.state === State.Playing;
        }
        return false;
      } else {
        // Resuming from pause - needs state confirmation like play()
        console.log('[AudioService] Resuming playback...');
        await TP.play();

        // Wait for Playing state with retry logic
        const RESUME_TIMEOUT = 5000;
        const t0 = Date.now();
        let retries = 0;
        const MAX_RETRIES = 3;

        while (Date.now() - t0 < RESUME_TIMEOUT) {
          const currentState = await TP.getPlaybackState();

          if (currentState.state === State.Playing) {
            console.log(`[AudioService] Resume confirmed (retries: ${String(retries)})`);
            return true;
          }

          if (currentState.state === State.Error) {
            console.error('[AudioService] Error state during resume');
            throw new Error('Failed to resume playback');
          }

          // If stuck in Ready/Paused, retry play()
          if (
            (currentState.state === State.Ready || currentState.state === State.Paused) &&
            retries < MAX_RETRIES
          ) {
            retries++;
            console.log(`[AudioService] Re-issuing play() for resume (attempt ${String(retries)})`);
            await TP.play();
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Final check
        const finalState = await TP.getPlaybackState();
        console.warn('[AudioService] Resume timeout, final state:', finalState.state);
        return finalState.state === State.Playing;
      }
    },

    destroy: (): void => {
      console.log('[AudioService] destroy() called');
      // Reset the player on destroy
      void TP.reset();
      isSetup = false;
      setupPromise = null;
      lastStreamUrl = null;
      lastStreamTitle = null;
    },

    // New: Get current playback state as string
    getPlaybackState: async (): Promise<string> => {
      try {
        const state = await TP.getPlaybackState();
        return state.state as string;
      } catch {
        return 'unknown';
      }
    },

    // New: Verify playback is actually happening (for foreground check)
    verifyPlayback: async (): Promise<boolean> => {
      try {
        const state = await TP.getPlaybackState();
        const position1 = await TP.getProgress();

        // If not playing, return false
        if (state.state !== State.Playing) {
          return false;
        }

        // For live streams, check if we're receiving data by checking buffered position
        // Wait a short time and check if position/buffer has changed
        await new Promise((resolve) => setTimeout(resolve, 500));
        const position2 = await TP.getProgress();

        // For live streams, buffered position should be increasing
        // or position should be changing
        const isProgressing =
          position2.buffered > position1.buffered || position2.position !== position1.position;

        if (!isProgressing) {
          console.warn(
            '[AudioService] Playback appears stalled:',
            'pos1=',
            position1.position,
            'pos2=',
            position2.position
          );
        }

        // At this point we're in Playing state. Even if positions haven't changed,
        // consider playback valid for live streams that may not report progress.
        return true;
      } catch (error) {
        console.error('[AudioService] verifyPlayback error:', error);
        return false;
      }
    },

    // New: Reconnect to the last known stream
    reconnectStream: async (): Promise<void> => {
      if (lastStreamUrl === null || lastStreamTitle === null) {
        console.log('[AudioService] No stream to reconnect to');
        return;
      }

      console.log('[AudioService] Reconnecting to stream:', lastStreamTitle);

      // Get the audioStore to trigger a proper playStream
      // This is a simplified reconnect - the full implementation goes through audioStore
      const track = {
        id: 'live-stream',
        url: lastStreamUrl,
        title: lastStreamTitle,
        artist: 'Nicecream.fm',
        artwork: 'https://nicecream.fm/icon.png',
        isLiveStream: true,
      };

      try {
        await TP.load(track);
        await TP.play();

        // Verify playback started
        const confirmed = await waitForState(State.Playing, 5000);
        if (!confirmed) {
          throw new Error('Reconnect failed - playback not confirmed');
        }

        console.log('[AudioService] Reconnect successful');
      } catch (error) {
        console.error('[AudioService] Reconnect failed:', error);
        throw error;
      }
    },

    // Seek to live edge for live streams
    // For live streams, this reloads the stream to get to the current live position
    seekToLive: async (): Promise<void> => {
      if (lastStreamUrl === null || lastStreamTitle === null) {
        console.log('[AudioService] No stream to seek to live');
        return;
      }

      console.log('[AudioService] Seeking to live edge...');

      const track = {
        id: 'live-stream',
        url: lastStreamUrl,
        title: lastStreamTitle,
        artist: 'Nicecream.fm',
        artwork: 'https://nicecream.fm/icon.png',
        isLiveStream: true,
      };

      try {
        // For live streams, reload the track to jump to the live edge
        await TP.setPlayWhenReady(false);
        await TP.load(track);

        // Wait for Ready state
        const ready = await waitForState(State.Ready, 5000);
        if (!ready) {
          throw new Error('Failed to load stream for seek-to-live');
        }

        await TP.play();

        // Verify playback started
        const playing = await waitForState(State.Playing, 5000);
        if (!playing) {
          throw new Error('Failed to start playback after seek-to-live');
        }

        console.log('[AudioService] Seek to live successful');
      } catch (error) {
        console.error('[AudioService] Seek to live failed:', error);
        throw error;
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
    // Initialize TrackPlayer before returning
    await audioServiceInstance.setup();
    return audioServiceInstance;
  } catch (error) {
    console.log('Failed to initialize audio service:', error);
    audioServiceInstance = mockAudioService;
    return mockAudioService;
  }
}

// Export for cleanup
export function destroyAudioService(): void {
  if (audioServiceInstance !== null) {
    audioServiceInstance.destroy();
    audioServiceInstance = null;
  }
  // Also cleanup playback service listeners (only if not in Expo Go)
  if (!isExpoGo) {
    void import('./playbackService.native').then(({ cleanupPlaybackService }) => {
      cleanupPlaybackService();
    });
  }
}

export { isExpoGo };
