// Web audio service using HTML5 Audio API

interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
  destroy: () => void;
}

let audioElement: HTMLAudioElement | null = null;
let isPlaying = false;

// P0 Fix: Setup promise deduplication to prevent race conditions
let setupPromise: Promise<boolean> | null = null;

// P0 Fix: Request ID for cancelling stale play requests
let currentPlayRequestId = 0;

// P0 Fix: Store event listener references for cleanup
interface EventListenerEntry {
  event: string;
  handler: EventListener;
}
let eventListeners: EventListenerEntry[] = [];

// P1 Fix: Visibility API handler reference
let visibilityHandler: (() => void) | null = null;

// Helper to get store lazily (avoids circular dependency)
const getStore = (): typeof import('@/store/audioStore').useAudioStore =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
  require('@/store/audioStore').useAudioStore as typeof import('@/store/audioStore').useAudioStore;

// P0 Fix: Centralized event listener management
function addAudioEventListener(event: string, handler: EventListener): void {
  if (audioElement === null) return;
  audioElement.addEventListener(event, handler);
  eventListeners.push({ event, handler });
}

function removeAllEventListeners(): void {
  if (audioElement === null) return;
  for (const { event, handler } of eventListeners) {
    audioElement.removeEventListener(event, handler);
  }
  eventListeners = [];
}

// P1 Fix: Visibility API - pause when tab is hidden (optional behavior)
function setupVisibilityHandler(): void {
  if (typeof document === 'undefined' || visibilityHandler !== null) return;

  visibilityHandler = (): void => {
    // When tab becomes hidden, we could pause (configurable behavior)
    // For now, we just track the state - live streams typically continue
    // Uncomment below to pause on tab hide:
    // if (document.hidden && isPlaying && audioElement !== null) {
    //   audioElement.pause();
    // }
  };

  document.addEventListener('visibilitychange', visibilityHandler);
}

function removeVisibilityHandler(): void {
  if (typeof document === 'undefined' || visibilityHandler === null) return;
  document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = null;
}

const webAudioService: AudioService = {
  isAvailable: true,

  // P0 Fix: Promise deduplication for setup
  setup: (): Promise<boolean> => {
    // Return existing setup promise if in progress
    if (setupPromise !== null) {
      return setupPromise;
    }

    // Already setup
    if (audioElement !== null) {
      return Promise.resolve(true);
    }

    setupPromise = new Promise((resolve) => {
      if (typeof window === 'undefined') {
        setupPromise = null;
        resolve(false);
        return;
      }

      audioElement = new Audio();
      audioElement.preload = 'none';

      // Error handling
      addAudioEventListener('error', () => {
        const error = audioElement?.error;
        const message = error?.message ?? 'Unknown audio error';
        getStore().getState().setError(message);
      });

      // Handle buffering states
      addAudioEventListener('waiting', () => {
        getStore().setState({ status: 'loading' });
      });

      addAudioEventListener('playing', () => {
        isPlaying = true;
        getStore().setState({ status: 'playing' });
      });

      addAudioEventListener('play', () => {
        isPlaying = true;
      });

      addAudioEventListener('pause', () => {
        isPlaying = false;
        // Only update state if we have a source (ignore when stopped)
        if (audioElement?.src !== undefined && audioElement.src !== '') {
          getStore().setState({ status: 'paused' });
        }
      });

      addAudioEventListener('ended', () => {
        isPlaying = false;
      });

      // P1 Fix: Setup visibility handler
      setupVisibilityHandler();

      resolve(true);
    });

    return setupPromise;
  },

  // P0 Fix: Request ID to prevent stale request corruption
  play: async (url: string, _title: string): Promise<void> => {
    // Increment request ID to cancel any in-flight requests
    const thisRequestId = ++currentPlayRequestId;

    if (audioElement === null) {
      await webAudioService.setup();
    }

    // Check if superseded after async setup
    if (thisRequestId !== currentPlayRequestId) {
      return;
    }

    if (audioElement !== null) {
      // Stop existing playback cleanly
      if (!audioElement.paused) {
        audioElement.pause();
      }

      // Check if superseded after pause
      if (thisRequestId !== currentPlayRequestId) {
        return;
      }

      // Clear and reset
      audioElement.src = '';
      audioElement.load();

      // Set new source
      audioElement.src = url;

      try {
        await audioElement.play();

        // Check if superseded after play started
        if (thisRequestId !== currentPlayRequestId) {
          // Stop this now-stale playback
          audioElement.pause();
          return;
        }

        isPlaying = true;
      } catch (e) {
        // Check if superseded - don't throw errors for stale requests
        if (thisRequestId !== currentPlayRequestId) {
          return;
        }

        if (e instanceof Error && e.name === 'NotAllowedError') {
          // Autoplay blocked - user interaction needed
          throw new Error('Click play to start audio');
        }
        throw e;
      }
    }
  },

  pause: (): Promise<void> => {
    if (audioElement !== null) {
      audioElement.pause();
      isPlaying = false;
    }
    return Promise.resolve();
  },

  stop: (): Promise<void> => {
    if (audioElement !== null) {
      audioElement.pause();
      audioElement.src = '';
      isPlaying = false;
    }
    return Promise.resolve();
  },

  togglePlayback: async () => {
    if (audioElement === null) {
      return false;
    }
    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
    } else {
      await audioElement.play();
      isPlaying = true;
    }
    return isPlaying;
  },

  // P0/P2 Fix: Proper cleanup method
  destroy: (): void => {
    // Remove all audio element event listeners
    removeAllEventListeners();

    // Remove visibility handler
    removeVisibilityHandler();

    // Stop and clean up audio element
    if (audioElement !== null) {
      audioElement.pause();
      audioElement.src = '';
      audioElement = null;
    }

    // Reset state
    isPlaying = false;
    setupPromise = null;
    currentPlayRequestId = 0;
  },
};

let audioServiceInstance: AudioService | null = null;

export async function getAudioService(): Promise<AudioService> {
  if (audioServiceInstance !== null) {
    return audioServiceInstance;
  }
  audioServiceInstance = webAudioService;
  await audioServiceInstance.setup();
  return audioServiceInstance;
}

// Web is never "Expo Go"
export const isExpoGo = false;
