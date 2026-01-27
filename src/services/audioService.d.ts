export interface AudioService {
  isAvailable: boolean;
  setup: () => Promise<boolean>;
  play: (url: string, title: string, signal?: AbortSignal) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayback: () => Promise<boolean>;
  destroy: () => void;
}

export function getAudioService(): Promise<AudioService>;
export const isExpoGo: boolean;
