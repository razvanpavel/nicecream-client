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
  const currentStreamUrl = useAudioStore((state) => state.currentStreamUrl);
  const currentStreamName = useAudioStore((state) => state.currentStreamName);

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
  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus): Promise<void> => {
      if (isExpoGo) return;

      console.log('[AudioLifecycle] AppState changed to:', nextAppState);

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background
        backgroundTimeRef.current = Date.now();
        wasPlayingRef.current = status === 'playing';
        console.log('[AudioLifecycle] App backgrounded, was playing:', wasPlayingRef.current);
      } else if (nextAppState === 'active') {
        // App coming to foreground
        const backgroundTime = backgroundTimeRef.current;
        backgroundTimeRef.current = null;

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

              console.log('[AudioLifecycle] Playback verified:', isActuallyPlaying);

              if (!isActuallyPlaying && status === 'playing') {
                // State says playing but audio isn't actually playing
                console.log('[AudioLifecycle] Playback stalled, attempting reconnect...');
                await audioService.reconnectStream();
              }
            } catch (error) {
              console.error('[AudioLifecycle] Failed to verify/reconnect playback:', error);
            }
          }
        }
      }
    },
    [status]
  );

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

  // Periodic health check while playing
  // Detects stalled playback, Bluetooth disconnection, audio route changes, etc.
  useEffect(() => {
    if (isExpoGo) return;

    // Clear any existing interval
    if (healthCheckIntervalRef.current !== null) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    // Only run health checks when we think we're playing
    if (status !== 'playing') {
      healthCheckFailuresRef.current = 0;
      return;
    }

    const performHealthCheck = async (): Promise<void> => {
      try {
        const audioService = await getAudioService();
        const isActuallyPlaying = await audioService.verifyPlayback();

        if (!isActuallyPlaying) {
          healthCheckFailuresRef.current++;
          console.warn(
            `[AudioLifecycle] Health check failed (${String(healthCheckFailuresRef.current)}/3)`
          );

          // After 3 consecutive failures, attempt reconnection
          if (healthCheckFailuresRef.current >= 3) {
            console.log('[AudioLifecycle] Multiple health check failures, attempting reconnect...');
            healthCheckFailuresRef.current = 0;

            if (currentStreamUrl !== null && currentStreamName !== null) {
              void useAudioStore.getState().playStream(currentStreamUrl, currentStreamName);
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

    // Start periodic health checks
    healthCheckIntervalRef.current = setInterval(() => {
      void performHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);

    console.log('[AudioLifecycle] Started periodic health checks');

    return (): void => {
      if (healthCheckIntervalRef.current !== null) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [status, currentStreamUrl, currentStreamName]);
}
