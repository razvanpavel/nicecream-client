// Web audio service using HTML5 Audio API

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

  setup: async () => {
    if (typeof window !== 'undefined' && audioElement === null) {
      audioElement = new Audio();
      audioElement.addEventListener('play', () => {
        isPlaying = true;
      });
      audioElement.addEventListener('pause', () => {
        isPlaying = false;
      });
      audioElement.addEventListener('ended', () => {
        isPlaying = false;
      });
    }
    return true;
  },

  play: async (url: string, _title: string) => {
    if (audioElement === null) {
      await webAudioService.setup();
    }
    if (audioElement !== null) {
      audioElement.src = url;
      await audioElement.play();
      isPlaying = true;
    }
  },

  pause: async () => {
    if (audioElement !== null) {
      audioElement.pause();
      isPlaying = false;
    }
  },

  stop: async () => {
    if (audioElement !== null) {
      audioElement.pause();
      audioElement.src = '';
      isPlaying = false;
    }
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
