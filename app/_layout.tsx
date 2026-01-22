import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import 'react-native-reanimated';

import { queryClient } from '@/api/queryClient';
import { PlaybackService } from '@/services/playbackService';
import { setupPlayer } from '@/services/playerSetup';
import { useAppStore } from '@/store/appStore';

import '../global.css';

// Register playback service (native only)
if (Platform.OS !== 'web') {
  TrackPlayer.registerPlaybackService(() => PlaybackService);
}

export default function RootLayout(): JSX.Element {
  const setPlayerSetup = useAppStore((state) => state.setPlayerSetup);

  useEffect(() => {
    const initPlayer = async (): Promise<void> => {
      if (Platform.OS !== 'web') {
        const isSetup = await setupPlayer();
        setPlayerSetup(isSetup);
      }
    };
    void initPlayer();
  }, [setPlayerSetup]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
