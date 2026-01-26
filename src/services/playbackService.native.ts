import TrackPlayer, { Event, State } from 'react-native-track-player';

import { useAudioStore } from '@/store/audioStore';

/**
 * Playback service that runs in the background
 * This handles remote controls (lock screen, notification, headphones, etc.)
 */
export function PlaybackService(): void {
  // Remote play (from notification, lock screen, headphones)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    void TrackPlayer.play();
  });

  // Remote pause
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    void TrackPlayer.pause();
  });

  // Remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    void TrackPlayer.stop();
  });

  // Remote seek (for scrubbing in notification)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    void TrackPlayer.seekTo(event.position);
  });

  // Handle headphone disconnect - pause playback
  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused) {
      void TrackPlayer.pause();
    } else if (event.permanent) {
      void TrackPlayer.stop();
    } else {
      void TrackPlayer.play();
    }
  });

  // Sync playback state changes to Zustand store
  // Note: During controlled transitions (isTransitioning=true), we ignore most state changes
  // to prevent the store from being overwritten during stream switches
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    const store = useAudioStore.getState();

    // During controlled transitions, handle state changes appropriately
    // This prevents unexpected states from overwriting our 'loading' state
    if (store.isTransitioning) {
      switch (event.state) {
        case State.Playing:
          useAudioStore.setState({ status: 'playing', isTransitioning: false });
          break;
        case State.Error:
          useAudioStore.setState({
            status: 'error',
            error: { message: 'Playback error', category: 'unknown', isRetryable: true },
            isTransitioning: false,
          });
          break;
        case State.Buffering:
        case State.Loading:
          // Expected during transition - keep status as 'loading'
          break;
        case State.Paused:
          // User might have quickly toggled - allow through
          useAudioStore.setState({ status: 'paused', isTransitioning: false });
          break;
        case State.Stopped:
        case State.None:
          // Unexpected during transition - log but don't change state
          console.warn('[PlaybackService] Unexpected stop during transition');
          break;
      }
      return;
    }

    switch (event.state) {
      case State.Playing:
        // Update to playing from any non-playing state
        if (store.status !== 'playing') {
          useAudioStore.setState({ status: 'playing' });
        }
        break;
      case State.Paused:
        if (store.status !== 'paused') {
          useAudioStore.setState({ status: 'paused' });
        }
        break;
      case State.Stopped:
      case State.None:
        if (store.status !== 'idle') {
          useAudioStore.setState({ status: 'idle' });
        }
        break;
      case State.Buffering:
      case State.Loading:
        // Only set loading if we're coming from idle - not from playing
        // Buffering during playback is normal for live streams
        if (store.status === 'idle') {
          useAudioStore.setState({ status: 'loading' });
        }
        break;
      case State.Error:
        useAudioStore.setState({
          status: 'error',
          error: { message: 'Playback error', category: 'unknown', isRetryable: true },
        });
        break;
    }
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('Playback error:', event);
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
