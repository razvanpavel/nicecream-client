import { create } from 'zustand';

import { getAudioService, isExpoGo } from '@/services/audioService';

// Request counter for cancelling stale play requests
let currentPlayRequestId = 0;

// AbortController for cancelling in-flight play requests across service boundary
let currentPlayAbortController: AbortController | null = null;

// Transition timeout to prevent deadlock
let transitionTimeoutId: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Transition Mutex Pattern
// Ensures only one transition can own state updates at a time
// Uses a token-based approach for atomic-like behavior in single-threaded JS
// ============================================================================

// Current transition owner token (null = no active transition)
let transitionOwnerToken: number | null = null;

// Acquire transition lock - returns token if successful, null if already locked
function acquireTransitionLock(requestId: number): number | null {
  if (transitionOwnerToken !== null) {
    console.log(
      `[TransitionMutex] Lock denied - owned by request #${String(transitionOwnerToken)}`
    );
    return null;
  }
  transitionOwnerToken = requestId;
  console.log(`[TransitionMutex] Lock acquired by request #${String(requestId)}`);
  return requestId;
}

// Release transition lock - only the owner can release
function releaseTransitionLock(token: number): boolean {
  if (transitionOwnerToken !== token) {
    console.warn(
      `[TransitionMutex] Release denied - token ${String(token)} != owner ${String(transitionOwnerToken)}`
    );
    return false;
  }
  transitionOwnerToken = null;
  console.log(`[TransitionMutex] Lock released by request #${String(token)}`);
  return true;
}

// Force release lock (for timeout safety)
function forceReleaseTransitionLock(): void {
  if (transitionOwnerToken !== null) {
    console.warn(
      `[TransitionMutex] Force releasing lock from request #${String(transitionOwnerToken)}`
    );
    transitionOwnerToken = null;
  }
}

// Helper to clear transition timeout
function clearTransitionTimeout(): void {
  if (transitionTimeoutId !== null) {
    clearTimeout(transitionTimeoutId);
    transitionTimeoutId = null;
  }
}

// ============================================================================
// Circuit Breaker Pattern
// Prevents cascading failures by temporarily blocking requests after repeated failures
// ============================================================================

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  successCount: number; // For HALF_OPEN state
}

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // Open circuit after this many failures
  resetTimeout: 30000, // Time to wait before trying again (30 seconds)
  halfOpenSuccessThreshold: 2, // Successes needed in HALF_OPEN to close circuit
};

// Circuit breaker state
let circuitBreaker: CircuitBreaker = {
  state: 'CLOSED',
  failureCount: 0,
  lastFailureTime: null,
  successCount: 0,
};

// Record a failure - may open the circuit
function recordCircuitFailure(): void {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  circuitBreaker.successCount = 0;

  if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    circuitBreaker.state = 'OPEN';
    console.warn(
      `[CircuitBreaker] Circuit OPENED after ${String(circuitBreaker.failureCount)} failures`
    );
  }
}

// Record a success - may close the circuit
function recordCircuitSuccess(): void {
  if (circuitBreaker.state === 'HALF_OPEN') {
    circuitBreaker.successCount++;
    if (circuitBreaker.successCount >= CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold) {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.failureCount = 0;
      circuitBreaker.successCount = 0;
      console.log('[CircuitBreaker] Circuit CLOSED - service recovered');
    }
  } else if (circuitBreaker.state === 'CLOSED') {
    // Reset failure count on success
    circuitBreaker.failureCount = 0;
  }
}

// Check if request should be allowed
function shouldAllowRequest(): boolean {
  if (circuitBreaker.state === 'CLOSED') {
    return true;
  }

  if (circuitBreaker.state === 'OPEN') {
    // Check if enough time has passed to try again
    const timeSinceLastFailure =
      circuitBreaker.lastFailureTime !== null
        ? Date.now() - circuitBreaker.lastFailureTime
        : Infinity;

    if (timeSinceLastFailure >= CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.successCount = 0;
      console.log('[CircuitBreaker] Circuit HALF_OPEN - testing service');
      return true;
    }

    console.log(
      `[CircuitBreaker] Circuit OPEN - blocking request (retry in ${String(
        Math.ceil((CIRCUIT_BREAKER_CONFIG.resetTimeout - timeSinceLastFailure) / 1000)
      )}s)`
    );
    return false;
  }

  // HALF_OPEN - allow limited requests
  return true;
}

// Reset circuit breaker (e.g., when user manually retries)
function resetCircuitBreaker(): void {
  circuitBreaker = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: null,
    successCount: 0,
  };
  console.log('[CircuitBreaker] Circuit manually reset');
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// P1 Fix: Error categorization for better UX
type ErrorCategory = 'network' | 'autoplay' | 'not_found' | 'auth' | 'unknown';

interface CategorizedError {
  message: string;
  category: ErrorCategory;
  isRetryable: boolean;
}

interface StreamMetadata {
  title?: string;
  artist?: string;
}

interface AudioState {
  // Playback state
  status: PlaybackStatus;
  currentStreamUrl: string | null;
  currentStreamName: string | null;
  streamMetadata: StreamMetadata | null;
  error: CategorizedError | null;

  // Feature flags
  isTrackPlayerAvailable: boolean;
  hasUserInteracted: boolean;

  // Retry state
  retryCount: number;
  isRetrying: boolean;

  // Transition flag - when true, playbackService should not update status
  // This prevents state conflicts during controlled stream switches
  isTransitioning: boolean;

  // Actions
  playStream: (url: string, stationName: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  seekToLive: () => Promise<void>;
  setStreamMetadata: (metadata: StreamMetadata) => void;
  setTrackPlayerAvailable: (available: boolean) => void;
  setUserInteracted: () => void;
  setError: (message: string) => void;
  clearError: () => void;
  retry: () => Promise<void>;
}

// P1 Fix: Categorize errors based on error message/type
function categorizeError(error: unknown): CategorizedError {
  if (!(error instanceof Error)) {
    return {
      message: 'An unknown error occurred',
      category: 'unknown',
      isRetryable: true,
    };
  }

  const message = error.message.toLowerCase();

  // Autoplay blocked (user interaction required)
  if (
    error.name === 'NotAllowedError' ||
    message.includes('autoplay') ||
    message.includes('click play')
  ) {
    return {
      message: 'Click play to start audio',
      category: 'autoplay',
      isRetryable: false,
    };
  }

  // Network errors (retryable)
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('offline') ||
    message.includes('failed to load') ||
    error.name === 'NetworkError' ||
    error.name === 'TimeoutError'
  ) {
    return {
      message: 'Network error. Retrying...',
      category: 'network',
      isRetryable: true,
    };
  }

  // Not found (permanent)
  if (message.includes('404') || message.includes('not found')) {
    return {
      message: 'Stream not available',
      category: 'not_found',
      isRetryable: false,
    };
  }

  // Auth errors (permanent)
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return {
      message: 'Access denied',
      category: 'auth',
      isRetryable: false,
    };
  }

  // Default: unknown but retryable
  return {
    message: error.message || 'Failed to play stream',
    category: 'unknown',
    isRetryable: true,
  };
}

// P1 Fix: Exponential backoff delay calculation
function getRetryDelay(retryCount: number): number {
  // Base delay: 1s, max delay: 8s
  // 1st retry: 1s, 2nd: 2s, 3rd: 4s
  const baseDelay = 1000;
  const maxDelay = 8000;
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

const MAX_RETRIES = 3;

export const useAudioStore = create<AudioState>((set, get) => ({
  status: 'idle',
  currentStreamUrl: null,
  currentStreamName: null,
  streamMetadata: null,
  error: null,
  isTrackPlayerAvailable: !isExpoGo,
  hasUserInteracted: false,
  retryCount: 0,
  isRetrying: false,
  isTransitioning: false,

  playStream: async (url: string, stationName: string): Promise<void> => {
    const { currentStreamUrl, status } = get();

    // Don't restart if already playing/loading this stream
    if (currentStreamUrl === url && (status === 'playing' || status === 'loading')) {
      return;
    }

    // Circuit breaker check - prevent cascading failures
    if (!shouldAllowRequest()) {
      const timeSinceLastFailure =
        circuitBreaker.lastFailureTime !== null ? Date.now() - circuitBreaker.lastFailureTime : 0;
      const retryIn = Math.ceil(
        (CIRCUIT_BREAKER_CONFIG.resetTimeout - timeSinceLastFailure) / 1000
      );

      set({
        status: 'error',
        error: {
          message: `Too many failures. Retry in ${String(retryIn)}s`,
          category: 'network',
          isRetryable: true,
        },
      });
      return;
    }

    // Abort any in-flight play request
    if (currentPlayAbortController !== null) {
      currentPlayAbortController.abort();
    }
    currentPlayAbortController = new AbortController();
    const signal = currentPlayAbortController.signal;

    // Increment request ID to cancel any in-flight requests
    const thisRequestId = ++currentPlayRequestId;

    // Update state to loading and mark as transitioning
    // isTransitioning prevents playbackService from overwriting our state
    set({
      status: 'loading',
      currentStreamUrl: url,
      currentStreamName: stationName,
      error: null,
      hasUserInteracted: true,
      retryCount: 0,
      isRetrying: false,
      isTransitioning: true,
    });

    // Clear any existing transition timeout
    if (transitionTimeoutId !== null) {
      clearTimeout(transitionTimeoutId);
    }

    // Acquire transition lock
    const lockToken = acquireTransitionLock(thisRequestId);
    if (lockToken === null) {
      // Another transition is in progress, but our AbortController already cancelled it
      // Force release and retry
      forceReleaseTransitionLock();
      acquireTransitionLock(thisRequestId);
    }

    // Safety timeout to prevent deadlock if something goes wrong
    transitionTimeoutId = setTimeout(() => {
      const state = get();
      if (state.isTransitioning) {
        console.warn('[AudioStore] Transition timeout - clearing flag and releasing lock');
        forceReleaseTransitionLock();
        set({ isTransitioning: false });
      }
    }, 15000); // 15 second timeout

    if (isExpoGo) {
      // Simulate loading delay for Expo Go
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check if this request was superseded
      if (thisRequestId !== currentPlayRequestId) {
        clearTransitionTimeout();
        return;
      }

      console.log(`[Expo Go] Would play: ${stationName}`);
      clearTransitionTimeout();
      set({ status: 'playing', isTransitioning: false });
      return;
    }

    // P1 Fix: Retry loop with exponential backoff
    let lastError: CategorizedError | null = null;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      try {
        // Check if this request was superseded
        if (thisRequestId !== currentPlayRequestId) {
          clearTransitionTimeout();
          return;
        }

        const audioService = await getAudioService();
        await audioService.play(url, stationName, signal);

        // Check if this request was superseded
        if (thisRequestId !== currentPlayRequestId) {
          clearTransitionTimeout();
          return;
        }

        // Success - clear any retry state and end transition
        clearTransitionTimeout();
        releaseTransitionLock(thisRequestId);
        recordCircuitSuccess(); // Circuit breaker: record success
        set({
          status: 'playing',
          retryCount: 0,
          isRetrying: false,
          error: null,
          isTransitioning: false,
        });
        return;
      } catch (error) {
        // Check if this request was superseded
        if (thisRequestId !== currentPlayRequestId) {
          clearTransitionTimeout();
          return;
        }

        lastError = categorizeError(error);
        console.error(
          `Failed to play stream (attempt ${String(retryCount + 1)}/${String(MAX_RETRIES + 1)}):`,
          error
        );

        // Don't retry non-retryable errors
        if (!lastError.isRetryable) {
          clearTransitionTimeout();
          releaseTransitionLock(thisRequestId);
          set({
            status: 'error',
            error: lastError,
            retryCount,
            isRetrying: false,
            isTransitioning: false,
          });
          return;
        }

        // Don't retry if we've exhausted retries
        if (retryCount >= MAX_RETRIES) {
          break;
        }

        // Calculate delay and wait
        const delay = getRetryDelay(retryCount);
        retryCount++;

        set({
          status: 'loading',
          error: {
            ...lastError,
            message: `Retrying... (${String(retryCount)}/${String(MAX_RETRIES)})`,
          },
          retryCount,
          isRetrying: true,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));

        // Check if superseded after delay
        if (thisRequestId !== currentPlayRequestId) {
          clearTransitionTimeout();
          return;
        }
      }
    }

    // All retries exhausted
    clearTransitionTimeout();
    releaseTransitionLock(thisRequestId);
    recordCircuitFailure(); // Circuit breaker: record failure
    if (lastError !== null) {
      set({
        status: 'error',
        error: {
          ...lastError,
          message:
            lastError.category === 'network'
              ? 'Unable to connect. Check your connection.'
              : lastError.message,
        },
        retryCount,
        isRetrying: false,
        isTransitioning: false,
      });
    }
  },

  togglePlayback: async (): Promise<void> => {
    const { status, currentStreamUrl, currentStreamName } = get();

    // Mark user interaction
    set({ hasUserInteracted: true });

    // If idle or error with a stream selected, start playing
    if (
      (status === 'idle' || status === 'error') &&
      currentStreamUrl !== null &&
      currentStreamName !== null
    ) {
      await get().playStream(currentStreamUrl, currentStreamName);
      return;
    }

    // If loading, ignore
    if (status === 'loading') {
      return;
    }

    if (isExpoGo) {
      set({ status: status === 'playing' ? 'paused' : 'playing' });
      return;
    }

    try {
      const audioService = await getAudioService();
      const nowPlaying = await audioService.togglePlayback();
      set({ status: nowPlaying ? 'playing' : 'paused' });
    } catch (error) {
      const categorized = categorizeError(error);
      console.error('Failed to toggle playback:', error);
      set({ status: 'error', error: categorized });
    }
  },

  stop: async (): Promise<void> => {
    if (isExpoGo) {
      set({
        status: 'idle',
        currentStreamUrl: null,
        currentStreamName: null,
        error: null,
        retryCount: 0,
        isRetrying: false,
      });
      return;
    }

    try {
      const audioService = await getAudioService();
      await audioService.stop();
      set({
        status: 'idle',
        currentStreamUrl: null,
        currentStreamName: null,
        error: null,
        retryCount: 0,
        isRetrying: false,
      });
    } catch (error) {
      console.error('Failed to stop playback:', error);
      set({
        status: 'idle',
        currentStreamUrl: null,
        currentStreamName: null,
        error: null,
        retryCount: 0,
        isRetrying: false,
      });
    }
  },

  seekToLive: async (): Promise<void> => {
    const { status } = get();

    // Only seek to live if we're playing or paused
    if (status !== 'playing' && status !== 'paused') {
      return;
    }

    if (isExpoGo) {
      console.log('[Expo Go] Would seek to live');
      return;
    }

    set({ status: 'loading' });

    try {
      const audioService = await getAudioService();
      await audioService.seekToLive();
      set({ status: 'playing' });
    } catch (error) {
      const categorized = categorizeError(error);
      console.error('Failed to seek to live:', error);
      set({ status: 'error', error: categorized });
    }
  },

  setStreamMetadata: (metadata: StreamMetadata): void => {
    set({ streamMetadata: metadata });
  },

  setTrackPlayerAvailable: (available: boolean): void => {
    set({ isTrackPlayerAvailable: available });
  },

  setUserInteracted: (): void => {
    set({ hasUserInteracted: true });
  },

  setError: (message: string): void => {
    const error = categorizeError(new Error(message));
    set({ status: 'error', error });
  },

  clearError: (): void => {
    set({ error: null, status: 'idle', retryCount: 0, isRetrying: false });
  },

  // P1 Fix: Manual retry action
  retry: async (): Promise<void> => {
    const { currentStreamUrl, currentStreamName, error } = get();

    if (currentStreamUrl === null || currentStreamName === null) {
      return;
    }

    // Reset circuit breaker on manual retry - user explicitly wants to try again
    resetCircuitBreaker();

    // Don't retry non-retryable errors without user explicitly triggering
    if (error !== null && !error.isRetryable) {
      // Reset retry count for manual retry
      set({ retryCount: 0 });
    }

    await get().playStream(currentStreamUrl, currentStreamName);
  },
}));

// Helper selectors
export const selectIsPlaying = (state: AudioState): boolean => state.status === 'playing';
export const selectIsLoading = (state: AudioState): boolean => state.status === 'loading';
export const selectHasError = (state: AudioState): boolean => state.status === 'error';
export const selectErrorCategory = (state: AudioState): ErrorCategory | null =>
  state.error?.category ?? null;
export const selectIsRetryable = (state: AudioState): boolean => state.error?.isRetryable ?? false;
