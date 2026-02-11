import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { getAudioService } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

// Check for Expo Go BEFORE any native module imports
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Debounce time for network reconnection attempts
const NETWORK_RECONNECT_DEBOUNCE_MS = 2000;
// Minimum time in background before we verify playback on foreground
const MIN_BACKGROUND_TIME_MS = 5000;
// Periodic health check interval (detects stalled playback, Bluetooth issues, etc.)
const HEALTH_CHECK_INTERVAL_MS = 30000;

/**
 * Hook that manages audio lifecycle events on native platforms:
 * - AppState monitoring (foreground/background transitions)
 * - Network connectivity monitoring
 * - Automatic playback verification and reconnection
 */
export function useAudioLifecycle(): void {
  const status = useAudioStore((state) => state.status);

  // Track when app went to background
  const backgroundTimeRef = useRef<number | null>(null);
  // Track last known network state
  const wasConnectedRef = useRef<boolean>(true);
  // Debounce network reconnection attempts
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we were playing before going to background
  const wasPlayingRef = useRef<boolean>(false);
  // Health check interval reference
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track consecutive health check failures for circuit breaker pattern
  const healthCheckFailuresRef = useRef<number>(0);
  // Track NetInfo unsubscribe function
  const netInfoUnsubscribeRef = useRef<(() => void) | null>(null);

  // Clear reconnect timeout helper
  const clearReconnectTimeout = useCallback((): void => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Handle app state changes (foreground/background)
  // BUG-4 fix: Read status from store inside callback to avoid stale closures
  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus): Promise<void> => {
    if (isExpoGo) return;

    console.log('[AudioLifecycle] AppState changed to:', nextAppState);

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background — read fresh status from store
      const currentStatus = useAudioStore.getState().status;
      backgroundTimeRef.current = Date.now();
      wasPlayingRef.current = currentStatus === 'playing';
      console.log('[AudioLifecycle] App backgrounded, was playing:', wasPlayingRef.current);
    } else if (nextAppState === 'active') {
      // App coming to foreground
      const backgroundTime = backgroundTimeRef.current;
      backgroundTimeRef.current = null;

      // Reassert Now Playing metadata in case iOS cleared it while backgrounded
      // (e.g. expo-video audio session interference, or OS garbage collection)
      void useAudioStore.getState().reassertNowPlaying();

      // Only verify if we were playing and were backgrounded for a significant time
      if (wasPlayingRef.current && backgroundTime !== null) {
        const timeInBackground = Date.now() - backgroundTime;
        console.log('[AudioLifecycle] App foregrounded after', timeInBackground, 'ms');

        if (timeInBackground > MIN_BACKGROUND_TIME_MS) {
          // Give a moment for the audio system to stabilize after app foreground
          await new Promise((resolve) => setTimeout(resolve, 500));

          try {
            const audioService = await getAudioService();
            const isActuallyPlaying = await audioService.verifyPlayback();

            // BUG-4 fix: Read fresh status from store instead of stale closure
            const freshState = useAudioStore.getState();

            console.log('[AudioLifecycle] Playback verified:', isActuallyPlaying);

            if (!isActuallyPlaying && freshState.status === 'playing') {
              // BUG-2 fix: Route through store for retry logic + circuit breaker
              console.log('[AudioLifecycle] Playback stalled, reconnecting via store...');
              if (freshState.currentStreamUrl !== null && freshState.currentStreamName !== null) {
                void freshState.playStream(
                  freshState.currentStreamUrl,
                  freshState.currentStreamName
                );
              }
            }
          } catch (error) {
            console.error('[AudioLifecycle] Failed to verify/reconnect playback:', error);
          }
        }
      }
    }
  }, []);

  // Set up AppState listener
  useEffect(() => {
    if (isExpoGo) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      void handleAppStateChange(nextAppState);
    });

    return (): void => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // Set up NetInfo listener (dynamically imported to avoid Expo Go crash)
  useEffect(() => {
    if (isExpoGo) return;

    // Dynamic import to avoid crash in Expo Go
    void import('@react-native-community/netinfo').then((NetInfo) => {
      const handleNetworkChange = (state: { isConnected: boolean | null }): void => {
        const isConnected = state.isConnected ?? false;
        const wasConnected = wasConnectedRef.current;
        wasConnectedRef.current = isConnected;

        console.log('[AudioLifecycle] Network state:', isConnected ? 'connected' : 'disconnected');

        // Update offline state in store
        useAppStore.getState().setOffline(!isConnected);

        // Network just came back
        if (isConnected && !wasConnected) {
          console.log('[AudioLifecycle] Network restored');

          // If we were trying to play something, attempt reconnect with debounce
          const currentStatus = useAudioStore.getState().status;
          const streamUrl = useAudioStore.getState().currentStreamUrl;
          const streamName = useAudioStore.getState().currentStreamName;

          if (
            (currentStatus === 'playing' ||
              currentStatus === 'loading' ||
              currentStatus === 'error') &&
            streamUrl !== null &&
            streamName !== null
          ) {
            clearReconnectTimeout();

            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[AudioLifecycle] Attempting reconnect after network restore...');
              // Trigger a replay through the store
              void useAudioStore.getState().playStream(streamUrl, streamName);
              reconnectTimeoutRef.current = null;
            }, NETWORK_RECONNECT_DEBOUNCE_MS);
          }
        }

        // Network lost while playing - the error will be caught by playbackService
        const currentStatus = useAudioStore.getState().status;
        if (!isConnected && wasConnected && currentStatus === 'playing') {
          console.log('[AudioLifecycle] Network lost while playing');
          // PlaybackService will handle the error state
          // We just log here for visibility
        }
      };

      netInfoUnsubscribeRef.current = NetInfo.default.addEventListener(handleNetworkChange);
    });

    return (): void => {
      if (netInfoUnsubscribeRef.current !== null) {
        netInfoUnsubscribeRef.current();
        netInfoUnsubscribeRef.current = null;
      }
      clearReconnectTimeout();
    };
  }, [clearReconnectTimeout]);

  // PERF-3 fix: Track playing state in a ref to avoid tearing down/recreating
  // the health check interval on every status flicker (playing→loading→playing).
  const isPlayingRef = useRef<boolean>(false);

  // Update the ref when status changes, but only start/stop interval on actual transitions
  useEffect(() => {
    if (isExpoGo) return;

    const wasPlaying = isPlayingRef.current;
    const isNowPlaying = status === 'playing';
    isPlayingRef.current = isNowPlaying;

    // Only act on actual transitions
    if (wasPlaying === isNowPlaying) return;

    if (isNowPlaying && healthCheckIntervalRef.current === null) {
      // Transitioned to playing — start health checks
      const performHealthCheck = async (): Promise<void> => {
        // Read fresh status from store to avoid stale state
        const freshStatus = useAudioStore.getState().status;
        if (freshStatus !== 'playing') return;

        try {
          const audioService = await getAudioService();
          const isActuallyPlaying = await audioService.verifyPlayback();

          if (!isActuallyPlaying) {
            healthCheckFailuresRef.current++;
            console.warn(
              `[AudioLifecycle] Health check failed (${String(healthCheckFailuresRef.current)}/2)`
            );

            // After 2 consecutive failures (with 2s sampling window each), attempt reconnection
            if (healthCheckFailuresRef.current >= 2) {
              console.log(
                '[AudioLifecycle] Multiple health check failures, attempting reconnect...'
              );
              healthCheckFailuresRef.current = 0;

              const store = useAudioStore.getState();
              if (store.currentStreamUrl !== null && store.currentStreamName !== null) {
                void store.playStream(store.currentStreamUrl, store.currentStreamName);
              }
            }
          } else {
            // Reset failure counter on successful check
            if (healthCheckFailuresRef.current > 0) {
              console.log('[AudioLifecycle] Health check recovered');
              healthCheckFailuresRef.current = 0;
            }
          }
        } catch (error) {
          console.error('[AudioLifecycle] Health check error:', error);
        }
      };

      healthCheckIntervalRef.current = setInterval(() => {
        void performHealthCheck();
      }, HEALTH_CHECK_INTERVAL_MS);

      console.log('[AudioLifecycle] Started periodic health checks');
    } else if (!isNowPlaying && healthCheckIntervalRef.current !== null) {
      // Transitioned away from playing — stop health checks
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
      healthCheckFailuresRef.current = 0;
      console.log('[AudioLifecycle] Stopped periodic health checks');
    }

    return (): void => {
      if (healthCheckIntervalRef.current !== null) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [status]);
}
