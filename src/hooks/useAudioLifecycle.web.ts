/**
 * Web implementation of useAudioLifecycle - no-op on web
 * The web audioService handles visibility changes internally
 */
export function useAudioLifecycle(): void {
  // No-op on web - visibility handling is done in audioService.web.ts
}
