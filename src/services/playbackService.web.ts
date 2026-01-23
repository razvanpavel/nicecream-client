/**
 * Playback service stub for web
 * Web doesn't support background playback or system media controls
 */
export async function PlaybackService(): Promise<void> {
  // No-op for web - background playback not supported
}
