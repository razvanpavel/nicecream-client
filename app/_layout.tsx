import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { queryClient } from '@/api/queryClient';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import '../global.css';

export default function RootLayout(): JSX.Element {
  const setPlayerSetup = useAppStore((state) => state.setPlayerSetup);
  const setTrackPlayerAvailable = useAudioStore((state) => state.setTrackPlayerAvailable);

  useEffect(() => {
    const initPlayer = async (): Promise<void> => {
      try {
        // Dynamically import TrackPlayer only on native platforms
        // This allows the app to run in Expo Go without crashing
        const TrackPlayer = await import('react-native-track-player');
        const { setupPlayer } = await import('@/services/playerSetup');
        const { PlaybackService } = await import('@/services/playbackService');

        TrackPlayer.default.registerPlaybackService(() => PlaybackService);
        const isSetup = await setupPlayer();
        setPlayerSetup(isSetup);
        setTrackPlayerAvailable(true);
      } catch (error) {
        // TrackPlayer not available (e.g., running in Expo Go)
        console.log('Audio player not available in Expo Go. Use a development build for audio.');
        setPlayerSetup(false);
        setTrackPlayerAvailable(false);
      }
    };
    void initPlayer();
  }, [setPlayerSetup, setTrackPlayerAvailable]);

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
