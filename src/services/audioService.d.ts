export interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string, signal?: AbortSignal) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
  destroy: () => void;
  // Enhanced lifecycle management methods
  getPlaybackState: () => Promise<string>;
  verifyPlayback: () => Promise<boolean>;
  reconnectStream: () => Promise<void>;
  // Live stream control
  seekToLive: () => Promise<void>;
}

export function getAudioService(): Promise<AudioService>;
export function destroyAudioService(): void;
export const isExpoGo: boolean;
