import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export type MusicService = 'spotify' | 'apple' | 'youtube';

/**
 * Generate a Spotify search URL for the given query
 * Format: https://open.spotify.com/search/{encoded_query}
 */
export function getSpotifySearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://open.spotify.com/search/${encoded}`;
}

/**
 * Generate an Apple Music search URL for the given query
 * Apple Music uses 'term' query parameter
 */
export function getAppleMusicSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://music.apple.com/us/search?term=${encoded}`;
}

/**
 * Generate a YouTube Music search URL for the given query
 * YouTube Music uses 'q' query parameter
 */
export function getYouTubeMusicSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://music.youtube.com/search?q=${encoded}`;
}

/**
 * Build a search query from artist and title
 */
function buildSearchQuery(artist: string, title: string): string {
  const parts = [artist, title].filter((part) => part.trim() !== '' && part !== '-');
  return parts.join(' ').trim();
}

/**
 * Open a music service search for the given artist and title
 */
export async function openMusicSearch(
  service: MusicService,
  artist: string,
  title: string
): Promise<void> {
  const query = buildSearchQuery(artist, title);

  if (query === '') {
    console.warn('[musicSearch] No valid search query');
    return;
  }

  let url: string;
  switch (service) {
    case 'spotify':
      url = getSpotifySearchUrl(query);
      break;
    case 'apple':
      url = getAppleMusicSearchUrl(query);
      break;
    case 'youtube':
      url = getYouTubeMusicSearchUrl(query);
      break;
  }

  console.log(`[musicSearch] Opening ${service}: ${url}`);

  try {
    if (Platform.OS === 'web') {
      // On web, open in a new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // On native, use WebBrowser which handles URL opening more reliably
      await WebBrowser.openBrowserAsync(url);
    }
  } catch (error) {
    console.error('[musicSearch] Failed to open URL:', error);
  }
}
