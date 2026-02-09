import { QueryClientProvider } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import 'expo-insights';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/api/queryClient';
import { useAudioLifecycle } from '@/hooks/useAudioLifecycle';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { destroyAudioService, getAudioService, isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import AlteHaasGroteskBold from '../assets/fonts/AlteHaasGroteskBold.ttf';
import AlteHaasGroteskRegular from '../assets/fonts/AlteHaasGroteskRegular.ttf';
import '../global.css';

// Suppress warnings
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Invariant Violation: Your JavaScript code tried to access a native module',
]);

// Register playback service SYNCHRONOUSLY at module level.
// This MUST complete before setupPlayer() is ever called.
// Using require() instead of dynamic import() to guarantee synchronous execution.
const isExpoGoRuntime = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (Platform.OS !== 'web' && !isExpoGoRuntime) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TrackPlayer = require('react-native-track-player') as {
    default: { registerPlaybackService: (factory: () => () => void) => void };
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PlaybackService } = require('@/services/playbackService') as {
    PlaybackService: () => void;
  };
  TrackPlayer.default.registerPlaybackService(() => PlaybackService);
}

// Keep splash screen visible while loading fonts
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.ReactElement | null {
  const setPlayerSetup = useAppStore((state) => state.setPlayerSetup);
  const setTrackPlayerAvailable = useAudioStore((state) => state.setTrackPlayerAvailable);

  // Poll now playing API when streaming
  useNowPlaying();

  // Monitor app state and network for audio lifecycle management
  useAudioLifecycle();

  const [fontsLoaded] = useFonts({
    'AlteHaasGrotesk-Bold': AlteHaasGroteskBold,
    'AlteHaasGrotesk-Regular': AlteHaasGroteskRegular,
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

    // Cleanup on unmount (app termination)
    return (): void => {
      destroyAudioService();
    };
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
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
