import { useEffect } from 'react';

import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

/**
 * Web implementation of useAudioLifecycle
 * Handles network status detection for offline banner and disabled controls
 * ENH-2: Also reconnects stream when network is restored
 */
export function useAudioLifecycle(): void {
  useEffect(() => {
    // Set initial online status
    useAppStore.getState().setOffline(!navigator.onLine);

    const handleOnline = (): void => {
      useAppStore.getState().setOffline(false);

      // ENH-2: Auto-reconnect when network returns if a stream was active
      const store = useAudioStore.getState();
      const { status, currentStreamUrl, currentStreamName } = store;

      if (
        (status === 'playing' || status === 'loading' || status === 'error') &&
        currentStreamUrl !== null &&
        currentStreamName !== null
      ) {
        console.log('[WebLifecycle] Network restored, reconnecting stream...');
        void store.playStream(currentStreamUrl, currentStreamName);
      }
    };

    const handleOffline = (): void => {
      useAppStore.getState().setOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
}
