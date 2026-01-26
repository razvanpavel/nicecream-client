// Suppress warnings FIRST before any other imports trigger them
import { LogBox, Platform } from 'react-native';
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Invariant Violation: Your JavaScript code tried to access a native module',
]);

// Register playback service at module level (must happen before any TrackPlayer methods)
if (Platform.OS !== 'web') {
  const TrackPlayer = require('react-native-track-player').default;
  const { PlaybackService } = require('@/services/playbackService');
  TrackPlayer.registerPlaybackService(() => PlaybackService);
}

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { queryClient } from '@/api/queryClient';
import { getAudioService, isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import '../global.css';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.ReactElement | null {
  const setPlayerSetup = useAppStore((state) => state.setPlayerSetup);
  const setTrackPlayerAvailable = useAudioStore((state) => state.setTrackPlayerAvailable);

  const [fontsLoaded] = useFonts({
    'AlteHaasGrotesk-Bold': require('../assets/fonts/AlteHaasGroteskBold.ttf'),
    'AlteHaasGrotesk-Regular': require('../assets/fonts/AlteHaasGroteskRegular.ttf'),
  });

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

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="[channel]" />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
