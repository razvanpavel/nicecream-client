import axios from 'axios';

const NOW_PLAYING_URL = 'https://play.nicecream.fm/api/nowplaying';

export interface NowPlayingStation {
  station: {
    listen_url: string;
  };
  now_playing: {
    song: {
      title: string;
    };
  };
}

export interface ParsedSongInfo {
  artist: string;
  title: string;
}

/**
 * Parse song details from the AzuraCast now playing response
 * Handles format: "prefix|||Artist Name - Song Title.mp3"
 */
export function parseSongTitle(rawTitle: string): ParsedSongInfo {
  // Split by ||| and take the last part
  const parts = rawTitle.split('|||');
  let fullName = parts[parts.length - 1] ?? rawTitle;

  // Remove .mp3 extension and trim
  fullName = fullName.replace('.mp3', '').trim();

  // Split by " - " to get artist and song
  if (fullName.includes(' - ')) {
    const [artist, ...titleParts] = fullName.split(' - ');
    return {
      artist: artist?.trim() ?? '-',
      title: titleParts.join(' - ').trim() || '-',
    };
  }

  return { artist: '-', title: '-' };
}

/**
 * Find the matching station from the now playing response
 * by checking if the station's listen_url contains the current stream URL
 */
export function findMatchingStation(
  stations: NowPlayingStation[],
  currentStreamUrl: string
): NowPlayingStation | undefined {
  // Extract a partial URL for matching (e.g., "/radio/8000" or "8000/red.mp3")
  const urlParts = currentStreamUrl.split('/');
  const radioIndex = urlParts.indexOf('radio');

  const partialUrl = radioIndex !== -1 ? urlParts[radioIndex + 1] : undefined;

  if (partialUrl != null) {
    return stations.find(
      (station) =>
        station.station.listen_url.includes(partialUrl) ||
        station.station.listen_url.includes(`/radio/${partialUrl}`)
    );
  }

  // Fallback: try to match any part of the URL
  return stations.find(
    (station) =>
      currentStreamUrl.includes(station.station.listen_url) ||
      station.station.listen_url.includes(currentStreamUrl.split('?')[0] ?? '')
  );
}

/**
 * Fetch now playing data from the AzuraCast API
 */
export async function fetchNowPlaying(): Promise<NowPlayingStation[]> {
  const response = await axios.get<NowPlayingStation[]>(NOW_PLAYING_URL, {
    timeout: 5000,
  });
  return response.data;
}

/**
 * Get the current song info for a specific stream URL
 */
export async function getNowPlayingForStream(streamUrl: string): Promise<ParsedSongInfo | null> {
  try {
    const stations = await fetchNowPlaying();
    const matchingStation = findMatchingStation(stations, streamUrl);

    if (matchingStation == null) {
      return null;
    }

    return parseSongTitle(matchingStation.now_playing.song.title);
  } catch (error) {
    console.error('Failed to fetch now playing data:', error);
    return null;
  }
}
