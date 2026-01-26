import { create } from 'zustand';

import { getAudioService, isExpoGo } from '@/services/audioService';

// Request counter for cancelling stale play requests
let currentPlayRequestId = 0;

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

  // Actions
  playStream: (url: string, stationName: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
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

  playStream: async (url: string, stationName: string): Promise<void> => {
    const { currentStreamUrl, status } = get();

    // Don't restart if already playing/loading this stream
    if (currentStreamUrl === url && (status === 'playing' || status === 'loading')) {
      return;
    }

    // Increment request ID to cancel any in-flight requests
    const thisRequestId = ++currentPlayRequestId;

    // Update state to loading
    set({
      status: 'loading',
      currentStreamUrl: url,
      currentStreamName: stationName,
      error: null,
      hasUserInteracted: true,
      retryCount: 0,
      isRetrying: false,
    });

    if (isExpoGo) {
      // Simulate loading delay for Expo Go
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check if this request was superseded
      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      console.log(`[Expo Go] Would play: ${stationName}`);
      set({ status: 'playing' });
      return;
    }

    // P1 Fix: Retry loop with exponential backoff
    let lastError: CategorizedError | null = null;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      try {
        // Check if this request was superseded
        if (thisRequestId !== currentPlayRequestId) {
          return;
        }

        const audioService = await getAudioService();
        await audioService.play(url, stationName);

        // Check if this request was superseded
        if (thisRequestId !== currentPlayRequestId) {
          return;
        }

        // Success - clear any retry state
        set({ status: 'playing', retryCount: 0, isRetrying: false, error: null });
        return;
      } catch (error) {
        // Check if this request was superseded
        if (thisRequestId !== currentPlayRequestId) {
          return;
        }

        lastError = categorizeError(error);
        console.error(
          `Failed to play stream (attempt ${String(retryCount + 1)}/${String(MAX_RETRIES + 1)}):`,
          error
        );

        // Don't retry non-retryable errors
        if (!lastError.isRetryable) {
          set({ status: 'error', error: lastError, retryCount, isRetrying: false });
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
          return;
        }
      }
    }

    // All retries exhausted
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
