import TrackPlayer, { Event, State } from 'react-native-track-player';

import { useAudioStore } from '@/store/audioStore';

// Fix 5: Buffering timeout — if buffering persists >5s while status is 'playing',
// show loading spinner so the UI doesn't appear stuck.
let bufferingTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearBufferingTimeout(): void {
  if (bufferingTimeoutId !== null) {
    clearTimeout(bufferingTimeoutId);
    bufferingTimeoutId = null;
  }
}

/**
 * Playback service that runs in the background
 * This handles remote controls (lock screen, notification, headphones, etc.)
 */
export function PlaybackService(): void {
  // Remote play (from notification, lock screen, headphones)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play().catch((e: unknown) => {
      console.error('[PlaybackService] RemotePlay failed:', e);
    });
  });

  // Remote pause
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause().catch((e: unknown) => {
      console.error('[PlaybackService] RemotePause failed:', e);
    });
  });

  // Remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop().catch((e: unknown) => {
      console.error('[PlaybackService] RemoteStop failed:', e);
    });
  });

  // Remote seek (for scrubbing in notification)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position).catch((e: unknown) => {
      console.error('[PlaybackService] RemoteSeek failed:', e);
    });
  });

  // Handle headphone disconnect - pause playback
  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused) {
      TrackPlayer.pause().catch((e: unknown) => {
        console.error('[PlaybackService] RemoteDuck pause failed:', e);
      });
    } else if (event.permanent) {
      TrackPlayer.stop().catch((e: unknown) => {
        console.error('[PlaybackService] RemoteDuck stop failed:', e);
      });
    } else {
      TrackPlayer.play().catch((e: unknown) => {
        console.error('[PlaybackService] RemoteDuck play failed:', e);
      });
    }
  });

  // Sync playback state changes to Zustand store
  // Note: During controlled transitions (isTransitioning=true), we ignore most state changes
  // to prevent the store from being overwritten during stream switches
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
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
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[PlaybackService] PlaybackError:', event);
    useAudioStore.setState({
      status: 'error',
      error: {
        message: event.message,
        category: 'unknown',
        isRetryable: true,
      },
    });
  });

  // Handle metadata updates (for Icecast streams that send track info)
  TrackPlayer.addEventListener(Event.MetadataCommonReceived, (event) => {
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
  });
}
