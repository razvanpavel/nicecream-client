import TrackPlayer, { Event, State } from 'react-native-track-player';

import { useAudioStore } from '@/store/audioStore';

/**
 * Playback service that runs in the background
 * This handles remote controls (lock screen, notification, headphones, etc.)
 */
export async function PlaybackService(): Promise<void> {
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
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    const store = useAudioStore.getState();

    switch (event.state) {
      case State.Playing:
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
        if (store.status !== 'loading') {
          useAudioStore.setState({ status: 'loading' });
        }
        break;
      case State.Error:
        useAudioStore.setState({ status: 'error', error: 'Playback error' });
        break;
    }
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('Playback error:', event);
    useAudioStore.setState({
      status: 'error',
      error: event.message ?? 'Playback failed',
    });
  });

  // Handle metadata updates (for Icecast streams that send track info)
  TrackPlayer.addEventListener(Event.PlaybackMetadataReceived, (event) => {
    const metadata: { title?: string; artist?: string } = {};

    if (event.title != null) {
      metadata.title = event.title;
    }
    if (event.artist != null) {
      metadata.artist = event.artist;
    }

    if (Object.keys(metadata).length > 0) {
      useAudioStore.setState({ streamMetadata: metadata });
    }
  });
}
