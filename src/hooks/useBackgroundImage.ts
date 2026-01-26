import { useCallback, useEffect, useRef } from 'react';

import { fetchAndPreloadBackground, type BackgroundCategory } from '@/api/backgrounds';
import { STREAMS } from '@/config/streams';
import { useAppStore } from '@/store/appStore';

const POLLING_INTERVAL_MS = 40000; // 40 seconds

/**
 * Hook that polls the background API and updates the background image
 * Background changes based on the current channel/stream
 */
export function useBackgroundImage(): void {
  const currentStreamIndex = useAppStore((state) => state.currentStreamIndex);
  const setBackgroundImage = useAppStore((state) => state.setBackgroundImage);
  const setBackgroundLoading = useAppStore((state) => state.setBackgroundLoading);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastChannelRef = useRef<BackgroundCategory | null>(null);

  const getCurrentChannel = useCallback((): BackgroundCategory => {
    const stream = STREAMS[currentStreamIndex];
    return (stream?.id ?? 'red') as BackgroundCategory;
  }, [currentStreamIndex]);

  const fetchAndUpdateBackground = useCallback(async (): Promise<void> => {
    const channel = getCurrentChannel();

    setBackgroundLoading(true);

    try {
      const background = await fetchAndPreloadBackground(channel);

      setBackgroundImage({
        url: background.image,
        author: background.author,
        authorUrl: background.authorUrl,
      });

      lastChannelRef.current = channel;
    } catch (error) {
      console.error('Failed to fetch background image:', error);
      // Keep the current background on error
    } finally {
      setBackgroundLoading(false);
    }
  }, [getCurrentChannel, setBackgroundImage, setBackgroundLoading]);

  // Fetch immediately when channel changes
  useEffect(() => {
    const currentChannel = getCurrentChannel();

    // Only fetch if channel changed or we don't have a background yet
    if (lastChannelRef.current !== currentChannel) {
      void fetchAndUpdateBackground();
    }
  }, [getCurrentChannel, fetchAndUpdateBackground]);

  // Set up polling interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void fetchAndUpdateBackground();
    }, POLLING_INTERVAL_MS);

    return (): void => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchAndUpdateBackground]);
}
