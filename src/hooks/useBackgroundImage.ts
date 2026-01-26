import { useCallback, useEffect, useRef } from 'react';

import { fetchAndPreloadBackground, type BackgroundCategory } from '@/api/backgrounds';
import { useAppStore, type ChannelId } from '@/store/appStore';

const POLLING_INTERVAL_MS = 40000; // 40 seconds
const CHANNELS: ChannelId[] = ['red', 'green', 'blue'];

/**
 * Hook that polls the background API and updates backgrounds for all channels
 * Fetches backgrounds for all three channels to ensure they're pre-loaded
 */
export function useBackgroundImage(): void {
  const setChannelBackground = useAppStore((state) => state.setChannelBackground);
  const setChannelBackgroundLoading = useAppStore((state) => state.setChannelBackgroundLoading);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialFetchDoneRef = useRef(false);

  const fetchBackgroundForChannel = useCallback(
    async (channel: ChannelId): Promise<void> => {
      setChannelBackgroundLoading(channel, true);

      try {
        const background = await fetchAndPreloadBackground(channel as BackgroundCategory);

        setChannelBackground(channel, {
          url: background.image,
          author: background.author,
          authorUrl: background.authorUrl,
        });
      } catch (error) {
        console.error(`Failed to fetch background for ${channel}:`, error);
        // Keep the current background on error
      } finally {
        setChannelBackgroundLoading(channel, false);
      }
    },
    [setChannelBackground, setChannelBackgroundLoading]
  );

  const fetchAllBackgrounds = useCallback(async (): Promise<void> => {
    // Fetch all channels in parallel
    await Promise.all(CHANNELS.map((channel) => fetchBackgroundForChannel(channel)));
  }, [fetchBackgroundForChannel]);

  // Fetch backgrounds for all channels on mount
  useEffect(() => {
    if (!initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      void fetchAllBackgrounds();
    }
  }, [fetchAllBackgrounds]);

  // Set up polling interval to refresh all backgrounds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void fetchAllBackgrounds();
    }, POLLING_INTERVAL_MS);

    return (): void => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchAllBackgrounds]);
}
