import { useEffect } from 'react';

import { useAppStore } from '@/store/appStore';

/**
 * Web implementation of useAudioLifecycle
 * Handles network status detection for offline banner and disabled controls
 */
export function useAudioLifecycle(): void {
  useEffect(() => {
    // Set initial online status
    useAppStore.getState().setOffline(!navigator.onLine);

    const handleOnline = (): void => {
      useAppStore.getState().setOffline(false);
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
