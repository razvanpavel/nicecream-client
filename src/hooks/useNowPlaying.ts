import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { getNowPlayingForStream } from '@/api/nowPlaying';
import { useAudioStore } from '@/store/audioStore';

const BASE_POLLING_INTERVAL_MS = 5000;
const MAX_POLLING_INTERVAL_MS = 30000;
// ENH-8: If ICY metadata arrived within this window, skip HTTP poll updates
const ICY_PRIORITY_WINDOW_MS = 10000;
// ENH-6: After this many unchanged responses, slow down polling
const UNCHANGED_THRESHOLD = 3;

/**
 * Hook that polls the now playing API and updates stream metadata
 * Only polls when a nicecream.fm stream is actively playing
 *
 * REL-5: Uses AbortController to cancel in-flight requests on cleanup/stream change
 * ENH-6: Adaptive polling — slows down when metadata is unchanged, backs off on errors
 * ENH-8: Metadata source priority — ICY metadata takes precedence over HTTP polling
 */
export function useNowPlaying(): void {
  const status = useAudioStore((state) => state.status);
  const currentStreamUrl = useAudioStore((state) => state.currentStreamUrl);
  const setStreamMetadata = useAudioStore((state) => state.setStreamMetadata);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // ENH-6: Track consecutive unchanged responses for adaptive polling
  const unchangedCountRef = useRef<number>(0);
  const lastMetadataRef = useRef<string>('');
  const currentIntervalRef = useRef<number>(BASE_POLLING_INTERVAL_MS);
  // ENH-8: Track last ICY metadata timestamp
  const lastIcyUpdateRef = useRef<number>(0);

  const isNicecreamStream = useCallback((url: string | null): boolean => {
    return url?.includes('play.nicecream') ?? false;
  }, []);

  const fetchAndUpdateMetadata = useCallback(async (): Promise<void> => {
    if (currentStreamUrl == null || !isNicecreamStream(currentStreamUrl)) {
      return;
    }

    // REL-5: Cancel any in-flight request before starting a new one
    if (abortControllerRef.current !== null) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const songInfo = await getNowPlayingForStream(currentStreamUrl, controller.signal);

    // Don't update if aborted
    if (controller.signal.aborted) return;

    if (songInfo != null) {
      const metadataKey = `${songInfo.artist}|${songInfo.title}`;

      // ENH-8: Check if ICY metadata arrived recently — if so, skip HTTP update
      // Only applies on native where ICY metadata is available via TrackPlayer
      if (Platform.OS !== 'web') {
        const timeSinceIcy = Date.now() - lastIcyUpdateRef.current;
        if (timeSinceIcy < ICY_PRIORITY_WINDOW_MS) {
          return;
        }
      }

      // ENH-6: Track unchanged responses for adaptive polling
      if (metadataKey === lastMetadataRef.current) {
        unchangedCountRef.current++;
      } else {
        unchangedCountRef.current = 0;
        lastMetadataRef.current = metadataKey;
      }

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
      // Reset adaptive state on stream change
      unchangedCountRef.current = 0;
      lastMetadataRef.current = '';
      currentIntervalRef.current = BASE_POLLING_INTERVAL_MS;

      // Fetch immediately when starting
      void fetchAndUpdateMetadata();

      // ENH-6: Adaptive polling interval
      const scheduleNext = (): void => {
        // Increase interval if metadata hasn't changed
        if (unchangedCountRef.current >= UNCHANGED_THRESHOLD) {
          currentIntervalRef.current = Math.min(
            currentIntervalRef.current * 1.5,
            MAX_POLLING_INTERVAL_MS
          );
        } else {
          currentIntervalRef.current = BASE_POLLING_INTERVAL_MS;
        }

        intervalRef.current = setTimeout(() => {
          void fetchAndUpdateMetadata().then(scheduleNext);
        }, currentIntervalRef.current) as unknown as ReturnType<typeof setInterval>;
      };

      scheduleNext();
    }

    return (): void => {
      if (intervalRef.current != null) {
        clearTimeout(intervalRef.current as unknown as ReturnType<typeof setTimeout>);
        intervalRef.current = null;
      }
      // REL-5: Abort any in-flight request on cleanup
      if (abortControllerRef.current !== null) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [status, currentStreamUrl, isNicecreamStream, fetchAndUpdateMetadata]);

  // ENH-8: Track ICY metadata updates to implement source priority (native only)
  // On web there's no ICY metadata, so this subscription would incorrectly
  // treat HTTP poll updates as ICY and block subsequent polls
  useEffect(() => {
    if (Platform.OS === 'web') return;

    return useAudioStore.subscribe((state, prevState) => {
      // Detect ICY-originated metadata updates (from playbackService MetadataCommonReceived)
      if (state.streamMetadata !== prevState.streamMetadata && state.streamMetadata !== null) {
        lastIcyUpdateRef.current = Date.now();
      }
    });
  }, []);
}
