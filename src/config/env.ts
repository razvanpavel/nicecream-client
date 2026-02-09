export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.nicecream.fm',
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'Nicecream.fm',
  artworkUrl: process.env.EXPO_PUBLIC_ARTWORK_URL ?? 'https://nicecream.fm/icons/512x512.png',
  isDev: __DEV__,
} as const;
