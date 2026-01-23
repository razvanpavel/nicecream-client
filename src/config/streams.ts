export interface StreamConfig {
  id: 'red' | 'green' | 'blue';
  name: string;
  url: string;
  color: string;
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
    name: 'Red',
    url:
      process.env.EXPO_PUBLIC_STREAM_RED ??
      'https://play.nicecream.fm/radio/8000/red.mp3?1769154137',
    color: BRAND_COLORS.red,
  },
  {
    id: 'green',
    name: 'Green',
    url:
      process.env.EXPO_PUBLIC_STREAM_GREEN ??
      'https://play.nicecream.fm/radio/8010/green.mp3?1769154137',
    color: BRAND_COLORS.green,
  },
  {
    id: 'blue',
    name: 'Blue',
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
 * - Morning (6 AM - 2 PM): Green
 * - Day (2 PM - 10 PM): Blue
 * - Night (10 PM - 6 AM): Red
 */
export function getDefaultStreamIndex(): number {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 14) {
    // Morning: 6 AM - 2 PM → Green
    return STREAM_INDEX.GREEN;
  } else if (hour >= 14 && hour < 22) {
    // Day: 2 PM - 10 PM → Blue
    return STREAM_INDEX.BLUE;
  } else {
    // Night: 10 PM - 6 AM → Red
    return STREAM_INDEX.RED;
  }
}

// For backwards compatibility
export const DEFAULT_STREAM_INDEX = getDefaultStreamIndex();
