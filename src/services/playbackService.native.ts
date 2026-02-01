import Constants, { ExecutionEnvironment } from 'expo-constants';

// Check if running in Expo Go BEFORE importing any native modules
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// No-op exports for Expo Go
// These are used when TrackPlayer isn't available

/**
 * Cleanup function to remove all event listeners
 * Called when destroying the audio service
 */
export function cleanupPlaybackService(): void {
  if (isExpoGo) {
    console.log('[PlaybackService] Expo Go - cleanup no-op');
    return;
  }
  // Real cleanup happens in initRealPlaybackService
  void import('react-native-track-player').then(() => {
    // Cleanup is handled by the initialized service
    console.log('[PlaybackService] Cleaning up event listeners...');
    cleanupRealService();
  });
}

/**
 * Playback service that runs in the background
 * This handles remote controls (lock screen, notification, headphones, etc.)
 */
export function PlaybackService(): void {
  if (isExpoGo) {
    console.log('[PlaybackService] Expo Go - PlaybackService no-op');
    return;
  }

  // Initialize the real playback service
  void initRealPlaybackService();
}

// ============================================================================
// Real implementation (only loaded when NOT in Expo Go)
// ============================================================================

// Fix 5: Buffering timeout — if buffering persists >5s while status is 'playing',
// show loading spinner so the UI doesn't appear stuck.
let bufferingTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Track if we were playing before an audio focus interruption (for smart resume)
let wasPlayingBeforeDuck = false;

// Track all event subscriptions for explicit cleanup
// Using generic array type since we can't reference TrackPlayer types at top level
let eventSubscriptions: { remove: () => void }[] = [];

// Track if service is initialized (singleton pattern)
let isServiceInitialized = false;

function clearBufferingTimeout(): void {
  if (bufferingTimeoutId !== null) {
    clearTimeout(bufferingTimeoutId);
    bufferingTimeoutId = null;
  }
}

function cleanupRealService(): void {
  clearBufferingTimeout();

  for (const subscription of eventSubscriptions) {
    subscription.remove();
  }
  eventSubscriptions = [];
  wasPlayingBeforeDuck = false;
  isServiceInitialized = false;

  console.log('[PlaybackService] Cleanup complete');
}

async function initRealPlaybackService(): Promise<void> {
  // Guard against double initialization
  if (isServiceInitialized) {
    console.log('[PlaybackService] Already initialized, skipping');
    return;
  }
  isServiceInitialized = true;
  console.log('[PlaybackService] Initializing event listeners...');

  // Dynamic import to avoid loading native module at parse time
  const TrackPlayer = await import('react-native-track-player');
  const { default: TP, Event, State } = TrackPlayer;

  // Import store after TrackPlayer to ensure proper initialization order
  const { useAudioStore } = await import('@/store/audioStore');

  // Remote play (from notification, lock screen, headphones)
  eventSubscriptions.push(
    TP.addEventListener(Event.RemotePlay, async () => {
      try {
        const activeTrack = await TP.getActiveTrack();

        if (activeTrack != null) {
          // Track loaded - just resume
          await TP.play();
        } else {
          // No track - need to reload the stream (happens after RemoteStop)
          const store = useAudioStore.getState();
          const { currentStreamUrl, currentStreamName } = store;

          if (currentStreamUrl !== null && currentStreamName !== null) {
            console.log('[PlaybackService] RemotePlay - reloading stream');
            // Use playStream to properly reload and sync state
            void store.playStream(currentStreamUrl, currentStreamName);
          } else {
            console.warn('[PlaybackService] RemotePlay - no stream to resume');
          }
        }
      } catch (e: unknown) {
        console.error('[PlaybackService] RemotePlay failed:', e);
      }
    })
  );

  // Remote pause
  eventSubscriptions.push(
    TP.addEventListener(Event.RemotePause, () => {
      TP.pause().catch((e: unknown) => {
        console.error('[PlaybackService] RemotePause failed:', e);
      });
    })
  );

  // Remote stop
  eventSubscriptions.push(
    TP.addEventListener(Event.RemoteStop, () => {
      TP.stop().catch((e: unknown) => {
        console.error('[PlaybackService] RemoteStop failed:', e);
      });
    })
  );

  // Remote seek (for scrubbing in notification)
  eventSubscriptions.push(
    TP.addEventListener(Event.RemoteSeek, (event) => {
      TP.seekTo(event.position).catch((e: unknown) => {
        console.error('[PlaybackService] RemoteSeek failed:', e);
      });
    })
  );

  // Handle audio focus changes (phone calls, other apps, headphones, etc.)
  // This is crucial for Android audio focus management
  eventSubscriptions.push(
    TP.addEventListener(Event.RemoteDuck, (event) => {
      console.log('[PlaybackService] RemoteDuck event:', {
        paused: event.paused,
        permanent: event.permanent,
      });

      if (event.paused) {
        // Temporary audio focus loss (e.g., notification sound, phone call)
        // Remember if we were playing so we can resume
        const currentStatus = useAudioStore.getState().status;
        wasPlayingBeforeDuck = currentStatus === 'playing';
        console.log('[PlaybackService] Audio ducked, was playing:', wasPlayingBeforeDuck);

        TP.pause().catch((e: unknown) => {
          console.error('[PlaybackService] RemoteDuck pause failed:', e);
        });
      } else if (event.permanent) {
        // Permanent audio focus loss (another app took over audio)
        console.log('[PlaybackService] Audio focus lost permanently');
        wasPlayingBeforeDuck = false;

        TP.stop().catch((e: unknown) => {
          console.error('[PlaybackService] RemoteDuck stop failed:', e);
        });
      } else {
        // Audio focus regained - only resume if we were playing before
        console.log('[PlaybackService] Audio focus regained, resuming:', wasPlayingBeforeDuck);

        if (wasPlayingBeforeDuck) {
          TP.play().catch((e: unknown) => {
            console.error('[PlaybackService] RemoteDuck play failed:', e);
          });
        }
        wasPlayingBeforeDuck = false;
      }
    })
  );

  // Sync playback state changes to Zustand store
  // Note: During controlled transitions (isTransitioning=true), we ignore most state changes
  // to prevent the store from being overwritten during stream switches
  eventSubscriptions.push(
    TP.addEventListener(Event.PlaybackState, (event) => {
      console.log(
        '[PlaybackService] PlaybackState event:',
        event.state,
        'transitioning:',
        useAudioStore.getState().isTransitioning
      );
      const store = useAudioStore.getState();

      // During controlled transitions, handle state changes appropriately
      // This prevents unexpected states from overwriting our 'loading' state
      if (store.isTransitioning) {
        switch (event.state) {
          case State.Playing:
          case State.Buffering:
          case State.Loading:
          case State.Ready:
            // Expected during transition — audioStore.playStream() owns the final state.
            // Do NOT clear isTransitioning here; the polling loop in audioService.play()
            // will confirm stable playback and audioStore will clear it.
            break;
          case State.Error:
            useAudioStore.setState({
              status: 'error',
              error: { message: 'Playback error', category: 'unknown', isRetryable: true },
              isTransitioning: false,
            });
            break;
          case State.Paused:
          case State.Stopped:
          case State.None:
            // Expected during transition cleanup (pause → reset → stopped → none).
            // Do NOT clear isTransitioning or update status — audioStore.playStream() owns it.
            break;
        }
        return;
      }

      switch (event.state) {
        case State.Playing:
          clearBufferingTimeout();
          if (store.status !== 'playing') {
            useAudioStore.setState({ status: 'playing' });
          }
          break;
        case State.Paused:
          clearBufferingTimeout();
          if (store.status !== 'paused') {
            useAudioStore.setState({ status: 'paused' });
          }
          break;
        case State.Ready:
          clearBufferingTimeout();
          // Ready = track loaded, playWhenReady is false.
          // Treat like paused — the player is idle with a track loaded.
          if (store.status !== 'paused' && store.status !== 'idle') {
            useAudioStore.setState({ status: 'paused' });
          }
          break;
        case State.Stopped:
        case State.None:
          clearBufferingTimeout();
          if (store.status !== 'idle') {
            useAudioStore.setState({ status: 'idle' });
          }
          break;
        case State.Buffering:
        case State.Loading:
          // Only set loading if we're coming from idle
          if (store.status === 'idle') {
            useAudioStore.setState({ status: 'loading' });
          }
          // Fix 5: If buffering during active playback, start a timeout.
          // If buffering persists >5s, show loading so the UI doesn't appear stuck.
          if (store.status === 'playing') {
            clearBufferingTimeout();
            bufferingTimeoutId = setTimeout(() => {
              const current = useAudioStore.getState();
              if (current.status === 'playing' && !current.isTransitioning) {
                useAudioStore.setState({ status: 'loading' });
              }
              bufferingTimeoutId = null;
            }, 5000);
          }
          break;
        case State.Error:
          clearBufferingTimeout();
          useAudioStore.setState({
            status: 'error',
            error: { message: 'Playback error', category: 'unknown', isRetryable: true },
          });
          break;
      }
    })
  );

  // Handle playback errors
  eventSubscriptions.push(
    TP.addEventListener(Event.PlaybackError, (event) => {
      console.error('[PlaybackService] PlaybackError:', event);
      useAudioStore.setState({
        status: 'error',
        error: {
          message: event.message,
          category: 'unknown',
          isRetryable: true,
        },
      });
    })
  );

  // Handle metadata updates (for Icecast streams that send track info)
  eventSubscriptions.push(
    TP.addEventListener(Event.MetadataCommonReceived, (event) => {
      const streamMetadata: { title?: string; artist?: string } = {};

      if (event.metadata.title !== undefined) {
        streamMetadata.title = event.metadata.title;
      }
      if (event.metadata.artist !== undefined) {
        streamMetadata.artist = event.metadata.artist;
      }

      if (Object.keys(streamMetadata).length > 0) {
        useAudioStore.setState({ streamMetadata });
      }
    })
  );

  console.log(
    `[PlaybackService] Initialized with ${String(eventSubscriptions.length)} event listeners`
  );
}
