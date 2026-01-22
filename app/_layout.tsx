import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { queryClient } from '@/api/queryClient';
import { getAudioService, isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import '../global.css';

export default function RootLayout(): JSX.Element {
  const setPlayerSetup = useAppStore((state) => state.setPlayerSetup);
  const setTrackPlayerAvailable = useAudioStore((state) => state.setTrackPlayerAvailable);

  useEffect(() => {
    const initPlayer = async (): Promise<void> => {
      if (isExpoGo) {
        console.log('Running in Expo Go - audio disabled. Create a development build for audio.');
        setPlayerSetup(false);
        setTrackPlayerAvailable(false);
        return;
      }

      try {
        const audioService = await getAudioService();
        const isSetup = await audioService.setup();
        setPlayerSetup(isSetup);
        setTrackPlayerAvailable(audioService.isAvailable);
      } catch (error) {
        console.log('Failed to setup audio:', error);
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
