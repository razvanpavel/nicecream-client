import { useCallback, useEffect, useRef } from 'react';

import { getNowPlayingForStream } from '@/api/nowPlaying';
import { useAudioStore } from '@/store/audioStore';

const POLLING_INTERVAL_MS = 5000; // 5 seconds

/**
 * Hook that polls the now playing API and updates stream metadata
 * Only polls when a nicecream.fm stream is actively playing
 */
export function useNowPlaying(): void {
  const status = useAudioStore((state) => state.status);
  const currentStreamUrl = useAudioStore((state) => state.currentStreamUrl);
  const setStreamMetadata = useAudioStore((state) => state.setStreamMetadata);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNicecreamStream = useCallback((url: string | null): boolean => {
    return url?.includes('play.nicecream') ?? false;
  }, []);

  const fetchAndUpdateMetadata = useCallback(async (): Promise<void> => {
    if (currentStreamUrl == null || !isNicecreamStream(currentStreamUrl)) {
      return;
    }

    const songInfo = await getNowPlayingForStream(currentStreamUrl);

    if (songInfo != null) {
      setStreamMetadata({
        artist: songInfo.artist,
        title: songInfo.title,
      });
    }
  }, [currentStreamUrl, isNicecreamStream, setStreamMetadata]);

  useEffect(() => {
    // Only poll when playing a nicecream stream
    const shouldPoll = status === 'playing' && isNicecreamStream(currentStreamUrl);

    if (shouldPoll) {
      // Fetch immediately when starting
      void fetchAndUpdateMetadata();

      // Set up polling interval
      intervalRef.current = setInterval(() => {
        void fetchAndUpdateMetadata();
      }, POLLING_INTERVAL_MS);
    }

    return (): void => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, currentStreamUrl, isNicecreamStream, fetchAndUpdateMetadata]);
}
