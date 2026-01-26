// Web audio service using HTML5 Audio API

import { useAudioStore } from '@/store/audioStore';

interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
}

let audioElement: HTMLAudioElement | null = null;
let isPlaying = false;

const webAudioService: AudioService = {
  isAvailable: true,

  setup: (): Promise<boolean> => {
    if (typeof window !== 'undefined' && audioElement === null) {
      audioElement = new Audio();
      audioElement.preload = 'none';

      // Error handling
      audioElement.addEventListener('error', () => {
        const error = audioElement?.error;
        const message = error?.message ?? 'Unknown audio error';
        useAudioStore.getState().setError(message);
      });

      // Handle buffering states
      audioElement.addEventListener('waiting', () => {
        useAudioStore.setState({ status: 'loading' });
      });

      audioElement.addEventListener('playing', () => {
        isPlaying = true;
        useAudioStore.setState({ status: 'playing' });
      });

      audioElement.addEventListener('play', () => {
        isPlaying = true;
      });

      audioElement.addEventListener('pause', () => {
        isPlaying = false;
        // Only update state if we have a source (ignore when stopped)
        if (audioElement?.src !== undefined && audioElement.src !== '') {
          useAudioStore.setState({ status: 'paused' });
        }
      });

      audioElement.addEventListener('ended', () => {
        isPlaying = false;
      });
    }
    return Promise.resolve(true);
  },

  play: async (url: string, _title: string): Promise<void> => {
    if (audioElement === null) {
      await webAudioService.setup();
    }

    if (audioElement !== null) {
      // Stop existing playback cleanly
      if (!audioElement.paused) {
        audioElement.pause();
      }

      // Clear and reset
      audioElement.src = '';
      audioElement.load();

      // Set new source
      audioElement.src = url;

      try {
        await audioElement.play();
        isPlaying = true;
      } catch (e) {
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
