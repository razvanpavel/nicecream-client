import Constants, { ExecutionEnvironment } from 'expo-constants';

import { env } from '@/config/env';

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
  // REL-4 fix: Call cleanupRealService() directly — it doesn't need TrackPlayer,
  // it just iterates eventSubscriptions[].remove()
  console.log('[PlaybackService] Cleaning up event listeners...');
  cleanupRealService();
}

/**
 * Playback service that runs in the background
 * This handles remote controls (lock screen, notification, headphones, etc.)
 *
 * IMPORTANT: All event listeners MUST be registered synchronously within this
 * function. Using async imports creates a race window where early TrackPlayer
 * events (PlaybackState, MetadataCommonReceived) fire before listeners exist,
 * causing lost state updates and metadata. We use synchronous require() to
 * ensure listeners are in place before any events can fire.
 */
export function PlaybackService(): void {
  if (isExpoGo) {
    console.log('[PlaybackService] Expo Go - PlaybackService no-op');
    return;
  }

  // Initialize the real playback service synchronously
  initRealPlaybackService();
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

function initRealPlaybackService(): void {
  // Guard against double initialization
  if (isServiceInitialized) {
    console.log('[PlaybackService] Already initialized, skipping');
    return;
  }
  isServiceInitialized = true;
  console.log('[PlaybackService] Initializing event listeners synchronously...');

  // Synchronous imports — event listeners MUST be registered before any
  // TrackPlayer events can fire. Async imports create a race window.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const TrackPlayer =
    require('react-native-track-player') as typeof import('react-native-track-player');
  const { default: TP, Event, State } = TrackPlayer;

  const { useAudioStore } = require('@/store/audioStore') as typeof import('@/store/audioStore');
  const { STREAMS } = require('@/config/streams') as typeof import('@/config/streams');
  /* eslint-enable @typescript-eslint/no-require-imports */

  // Remote play (from notification, lock screen, headphones)
  // For live streams, we ALWAYS reload - the buffer may be stale after pause/stop.
  // Unlike on-demand content, live streams can't simply "resume" from a paused position.
  eventSubscriptions.push(
    TP.addEventListener(Event.RemotePlay, () => {
      try {
        const store = useAudioStore.getState();
        const { currentStreamUrl, currentStreamName } = store;

        if (currentStreamUrl !== null && currentStreamName !== null) {
          console.log('[PlaybackService] RemotePlay - reloading live stream');
          // Always reload the stream to get fresh audio data
          void store.playStream(currentStreamUrl, currentStreamName);
        } else {
          console.warn('[PlaybackService] RemotePlay - no stream to resume');
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

  // ENH-4: RemoteNext — switch to the next channel
  eventSubscriptions.push(
    TP.addEventListener(Event.RemoteNext, () => {
      try {
        const store = useAudioStore.getState();
        const { currentStreamUrl } = store;
        const currentIndex = STREAMS.findIndex((s) => s.url === currentStreamUrl);
        const nextIndex = (currentIndex + 1) % STREAMS.length;
        const nextStream = STREAMS[nextIndex];
        if (nextStream !== undefined) {
          console.log('[PlaybackService] RemoteNext - switching to', nextStream.name);
          void store.playStream(nextStream.url, nextStream.name);
        }
      } catch (e: unknown) {
        console.error('[PlaybackService] RemoteNext failed:', e);
      }
    })
  );

  // ENH-4: RemotePrevious — switch to the previous channel
  eventSubscriptions.push(
    TP.addEventListener(Event.RemotePrevious, () => {
      try {
        const store = useAudioStore.getState();
        const { currentStreamUrl } = store;
        const currentIndex = STREAMS.findIndex((s) => s.url === currentStreamUrl);
        const prevIndex = (currentIndex - 1 + STREAMS.length) % STREAMS.length;
        const prevStream = STREAMS[prevIndex];
        if (prevStream !== undefined) {
          console.log('[PlaybackService] RemotePrevious - switching to', prevStream.name);
          void store.playStream(prevStream.url, prevStream.name);
        }
      } catch (e: unknown) {
        console.error('[PlaybackService] RemotePrevious failed:', e);
      }
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
        // REL-3 fix: Check TrackPlayer state directly instead of store status
        // (store may say 'loading' during transitions while TP is actually Playing)
        TP.getPlaybackState()
          .then((tpState) => {
            wasPlayingBeforeDuck = tpState.state === State.Playing;
            console.log('[PlaybackService] Audio ducked, was playing:', wasPlayingBeforeDuck);
            return TP.pause();
          })
          .catch((e: unknown) => {
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
          // BUG-3 fix: Reload the live stream instead of resuming stale buffer.
          // After an interruption (phone call, Siri), the buffer is stale —
          // potentially minutes behind live. Reload to get the live edge.
          const store = useAudioStore.getState();
          const { currentStreamUrl, currentStreamName } = store;

          if (currentStreamUrl !== null && currentStreamName !== null) {
            console.log('[PlaybackService] RemoteDuck resume - reloading live stream');
            void store.playStream(currentStreamUrl, currentStreamName);
          } else {
            // Fallback: no stream info, just try TP.play()
            TP.play().catch((e: unknown) => {
              console.error('[PlaybackService] RemoteDuck play failed:', e);
            });
          }
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
          // ENH-5: If buffering during active playback, show loading spinner
          // after 1.5s (reduced from 5s) so users see feedback quickly
          if (store.status === 'playing') {
            clearBufferingTimeout();
            bufferingTimeoutId = setTimeout(() => {
              const current = useAudioStore.getState();
              if (current.status === 'playing' && !current.isTransitioning) {
                useAudioStore.setState({ status: 'loading' });
              }
              bufferingTimeoutId = null;
            }, 1500);
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
      // Skip metadata updates during stream transitions to prevent flash of old content
      const { isTransitioning, currentStreamName } = useAudioStore.getState();
      if (isTransitioning) {
        return;
      }

      const streamMetadata: { title?: string; artist?: string } = {};

      if (event.metadata.title !== undefined) {
        streamMetadata.title = event.metadata.title;
      }
      if (event.metadata.artist !== undefined) {
        streamMetadata.artist = event.metadata.artist;
      }

      if (Object.keys(streamMetadata).length > 0) {
        useAudioStore.setState({ streamMetadata });

        // Update lock screen metadata with channel name prefix
        if (currentStreamName !== null) {
          const channelName =
            currentStreamName.charAt(0).toUpperCase() + currentStreamName.slice(1);
          const trackTitle = streamMetadata.title ?? '';
          const trackArtist = streamMetadata.artist ?? '';

          // Format: "Green: track artist - track name" or just "Green: track name" if no artist
          const lockScreenTitle =
            trackArtist !== '' && trackArtist !== '-'
              ? `${channelName}: ${trackArtist} - ${trackTitle}`
              : `${channelName}: ${trackTitle}`;

          // ENH-3: Use per-channel artwork if available
          const currentStreamUrl = useAudioStore.getState().currentStreamUrl;
          const matchingStream = STREAMS.find((s) => s.url === currentStreamUrl);
          const artworkUrl = matchingStream?.artworkUrl ?? env.artworkUrl;

          TP.updateNowPlayingMetadata({
            title: lockScreenTitle,
            artist: env.appName,
            artwork: artworkUrl,
            isLiveStream: true,
          }).catch((e: unknown) => {
            console.error('[PlaybackService] Failed to update now playing metadata:', e);
          });
        }
      }
    })
  );

  console.log(
    `[PlaybackService] Initialized with ${String(eventSubscriptions.length)} event listeners`
  );
}
