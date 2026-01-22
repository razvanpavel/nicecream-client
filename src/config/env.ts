export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.nicecream.fm',
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'Nicecream.fm',
  isDev: __DEV__,
} as const;
