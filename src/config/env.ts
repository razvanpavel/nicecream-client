export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://play.nicecream.fm',
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'nicecream.fm',
  artworkUrl: process.env.EXPO_PUBLIC_ARTWORK_URL ?? 'https://nicecream-fm.expo.app/icon.png',
  isDev: __DEV__,
} as const;
