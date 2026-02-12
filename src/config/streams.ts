export interface StreamConfig {
  id: 'red' | 'green' | 'blue';
  name: string;
  url: string;
  color: string;
  artworkUrl?: string;
}

// Brand colors
export const BRAND_COLORS = {
  red: '#EF3F36',
  green: '#5AB055',
  blue: '#2972FF',
} as const;

export const STREAMS: StreamConfig[] = [
  {
    id: 'red',
    name: 'red channel',
    url:
      process.env.EXPO_PUBLIC_STREAM_RED ??
      'https://play.nicecream.fm/radio/8000/red.mp3?1769154137',
    color: BRAND_COLORS.red,
  },
  {
    id: 'green',
    name: 'green channel',
    url:
      process.env.EXPO_PUBLIC_STREAM_GREEN ??
      'https://play.nicecream.fm/radio/8010/green.mp3?1769154137',
    color: BRAND_COLORS.green,
  },
  {
    id: 'blue',
    name: 'blue channel',
    url:
      process.env.EXPO_PUBLIC_STREAM_BLUE ??
      'https://play.nicecream.fm/radio/8020/blue.mp3?1769154137',
    color: BRAND_COLORS.blue,
  },
];

// Stream indices
export const STREAM_INDEX = {
  RED: 0, // Night
  GREEN: 1, // Morning
  BLUE: 2, // Day
} as const;

/**
 * Get the default stream index based on time of day
 * - Morning (8 AM - 2 PM): Green
 * - Day (2 PM - 8 PM): Blue
 * - Night (8 PM - 8 AM): Red
 */
export function getDefaultStreamIndex(): number {
  const hour = new Date().getHours();

  if (hour >= 8 && hour < 14) {
    // Morning: 8 AM - 2 PM → Green
    return STREAM_INDEX.GREEN;
  } else if (hour >= 14 && hour < 20) {
    // Day: 2 PM - 8 PM → Blue
    return STREAM_INDEX.BLUE;
  } else {
    // Night: 8 PM - 8 AM → Red
    return STREAM_INDEX.RED;
  }
}

/**
 * Get the channel ID (red, green, blue) for the current hour
 * Used for APIs that require channel-based parameters
 */
export function getChannelForHour(hour?: number): 'red' | 'green' | 'blue' {
  const currentHour = hour ?? new Date().getHours();

  if (currentHour >= 8 && currentHour < 14) {
    return 'green'; // Morning: 8 AM - 2 PM
  } else if (currentHour >= 14 && currentHour < 20) {
    return 'blue'; // Day: 2 PM - 8 PM
  } else {
    return 'red'; // Night: 8 PM - 8 AM
  }
}

// For backwards compatibility
export const DEFAULT_STREAM_INDEX = getDefaultStreamIndex();
