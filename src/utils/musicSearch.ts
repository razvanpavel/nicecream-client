import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export type MusicService = 'spotify' | 'apple' | 'youtube' | 'soundcloud';

/**
 * Generate a Spotify search URL for the given query
 * Uses Universal Links format - opens in app if installed, otherwise browser
 */
export function getSpotifySearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://open.spotify.com/search/${encoded}`;
}

/**
 * Generate Apple Music search URLs
 * Returns both native scheme and web fallback
 */
export function getAppleMusicSearchUrls(query: string): { native: string; web: string } {
  const encoded = encodeURIComponent(query);
  return {
    // Native URL scheme - opens directly in Apple Music app
    native: `music://music.apple.com/us/search?term=${encoded}`,
    // Web fallback - Universal Links may also open the app
    web: `https://music.apple.com/us/search?term=${encoded}`,
  };
}

/**
 * Generate a YouTube Music search URL for the given query
 * Uses Universal Links format - opens in app if installed, otherwise browser
 */
export function getYouTubeMusicSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://music.youtube.com/search?q=${encoded}`;
}

/**
 * Generate a SoundCloud search URL for the given query
 * Uses Universal Links format - opens in app if installed, otherwise browser
 */
export function getSoundCloudSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://soundcloud.com/search?q=${encoded}`;
}

/**
 * Build a search query from artist and title
 */
function buildSearchQuery(artist: string, title: string): string {
  const parts = [artist, title].filter((part) => part.trim() !== '' && part !== '-');
  return parts.join(' ').trim();
}

/**
 * Try to open a URL, returns true if successful
 */
async function tryOpenUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
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

  console.log(`[musicSearch] Searching for: "${query}" on ${service}`);

  try {
    if (Platform.OS === 'web') {
      // On web, open in a new tab
      let url: string;
      switch (service) {
        case 'spotify':
          url = getSpotifySearchUrl(query);
          break;
        case 'apple':
          url = getAppleMusicSearchUrls(query).web;
          break;
        case 'youtube':
          url = getYouTubeMusicSearchUrl(query);
          break;
        case 'soundcloud':
          url = getSoundCloudSearchUrl(query);
          break;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Native platforms
    switch (service) {
      case 'spotify': {
        const url = getSpotifySearchUrl(query);
        console.log(`[musicSearch] Opening Spotify: ${url}`);
        await Linking.openURL(url);
        break;
      }

      case 'apple': {
        const urls = getAppleMusicSearchUrls(query);
        // Try native scheme first (music://), then fall back to web URL
        console.log(`[musicSearch] Trying Apple Music native: ${urls.native}`);
        const nativeOpened = await tryOpenUrl(urls.native);
        if (!nativeOpened) {
          console.log(`[musicSearch] Falling back to Apple Music web: ${urls.web}`);
          await Linking.openURL(urls.web);
        }
        break;
      }

      case 'youtube': {
        const url = getYouTubeMusicSearchUrl(query);
        console.log(`[musicSearch] Opening YouTube Music: ${url}`);
        await Linking.openURL(url);
        break;
      }

      case 'soundcloud': {
        const url = getSoundCloudSearchUrl(query);
        console.log(`[musicSearch] Opening SoundCloud: ${url}`);
        await Linking.openURL(url);
        break;
      }
    }
  } catch (error) {
    console.error('[musicSearch] Failed to open URL:', error);
  }
}
