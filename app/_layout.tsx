import { QueryClientProvider } from '@tanstack/react-query';
import { Asset } from 'expo-asset';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import 'expo-insights';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/api/queryClient';
import { BottomNavigation } from '@/components/BottomNavigation';
import { HomeOverlay } from '@/components/HomeOverlay';
import { CHANNEL_BACKGROUNDS } from '@/config/backgrounds';
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

  // Preload background videos on web so channel switches are instant
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const sources = Object.values(CHANNEL_BACKGROUNDS);
    for (const source of sources) {
      if (typeof source === 'number') {
        const asset = Asset.fromModule(source);
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'video';
        link.href = asset.uri;
        document.head.appendChild(link);
      }
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // On web, skip SSG rendering to avoid React 19 hydration mismatches from
  // components without SSR support (expo-video, lottie-react, reanimated).
  // SEO meta tags are served from +html.tsx regardless.
  const [isHydrated, setIsHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS === 'web') setIsHydrated(true);
  }, []);

  if (!fontsLoaded || !isHydrated) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-black">
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          </Stack>
          <HomeOverlay />
          <BottomNavigation />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
