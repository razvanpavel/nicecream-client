export interface StreamConfig {
  id: 'red' | 'green' | 'blue';
  name: string;
  url: string;
  color: string;
  backgroundColor: string;
}

export const STREAMS: StreamConfig[] = [
  {
    id: 'red',
    name: '1.FM Deep House',
    url: process.env.EXPO_PUBLIC_STREAM_RED ?? 'http://185.33.21.112:80/deephouse_64',
    color: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  {
    id: 'green',
    name: 'House Station Live',
    url: process.env.EXPO_PUBLIC_STREAM_GREEN ?? 'http://c2.radioboss.fm:8224/autodj',
    color: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  {
    id: 'blue',
    name: 'Deep House Energy',
    url: process.env.EXPO_PUBLIC_STREAM_BLUE ?? 'https://fra-pioneer01.dedicateware.com:2930/;',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
];

export const DEFAULT_STREAM_INDEX = 1; // Green (center)
