import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { STREAMS } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import { PauseIcon, PlayIcon } from './icons';
import { Loader } from './Loader';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const streamsLogo = require('../../assets/images/logos/streams.png') as number;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const introVideo = require('../../assets/images/backgrounds/intro.mp4') as number;

/* eslint-disable @typescript-eslint/no-require-imports */
const CHANNEL_BLOCKS = [
  require('../../assets/images/logos/channel-niteride.png') as number,
  require('../../assets/images/logos/channel-suntrack.png') as number,
  require('../../assets/images/logos/channel-watermelon.png') as number,
  require('../../assets/images/logos/channel-workit.png') as number,
  require('../../assets/images/logos/channel-chill.png') as number,
];
/* eslint-enable @typescript-eslint/no-require-imports */

const TIMING_CONFIG = {
  duration: 400,
  easing: Easing.inOut(Easing.ease),
};

const DISMISS_THRESHOLD = 150;
const DISMISS_VELOCITY = 500;

export function HomeOverlay(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const isHomeVisible = useAppStore((s) => s.isHomeVisible);
  const setHomeVisible = useAppStore((s) => s.setHomeVisible);
  const currentStreamIndex = useAppStore((s) => s.currentStreamIndex);
  const isPlayerSetup = useAppStore((s) => s.isPlayerSetup);
  const status = useAudioStore((s) => s.status);
  const currentStreamUrl = useAudioStore((s) => s.currentStreamUrl);
  const togglePlayback = useAudioStore((s) => s.togglePlayback);
  const playStream = useAudioStore((s) => s.playStream);

  const [isFullyHidden, setIsFullyHidden] = useState(false);
  const isAnimatingRef = useRef(false);
  const overlayHeightRef = useRef(0);
  const translateY = useSharedValue(0);

  // Intro video background
  const player = useVideoPlayer(introVideo, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isOverlayVisibleRef = useRef(isHomeVisible);

  useEffect(() => {
    isOverlayVisibleRef.current = isHomeVisible;
  }, [isHomeVisible]);

  // Pause/play video based on overlay visibility
  useEffect(() => {
    if (isHomeVisible && !isFullyHidden) {
      player.play();
    } else {
      player.pause();
    }
  }, [isHomeVisible, isFullyHidden, player]);

  // Pause/play video on app background/foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      appStateRef.current = nextAppState;
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        player.pause();
      } else if (nextAppState === 'active' && isOverlayVisibleRef.current) {
        player.play();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return (): void => {
      subscription.remove();
    };
  }, [player]);

  const currentStream = STREAMS[currentStreamIndex];

  const isCurrentStreamActive =
    currentStreamUrl !== null && currentStream !== undefined
      ? currentStreamUrl === currentStream.url
      : false;
  const isPlaying = status === 'playing' && isCurrentStreamActive;
  const isLoading =
    (status === 'loading' && isCurrentStreamActive) || (!isPlayerSetup && !isExpoGo);

  const onHideComplete = useCallback((): void => {
    isAnimatingRef.current = false;
    setIsFullyHidden(true);
  }, []);

  const onShowComplete = useCallback((): void => {
    isAnimatingRef.current = false;
  }, []);

  const handleLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }): void => {
      overlayHeightRef.current = event.nativeEvent.layout.height;
    },
    []
  );

  // When visibility becomes true, immediately clear the hidden flag
  // (this runs synchronously during render, not in an effect)
  if (isHomeVisible && isFullyHidden) {
    setIsFullyHidden(false);
  }

  // Drive animation from visibility changes
  useEffect(() => {
    const height = overlayHeightRef.current;
    if (height === 0) return;

    isAnimatingRef.current = true;

    if (isHomeVisible) {
      translateY.value = withTiming(0, TIMING_CONFIG, (finished) => {
        'worklet';
        if (finished === true) {
          scheduleOnRN(onShowComplete);
        }
      });
    } else {
      translateY.value = withTiming(height, TIMING_CONFIG, (finished) => {
        'worklet';
        if (finished === true) {
          scheduleOnRN(onHideComplete);
        }
      });
    }
  }, [isHomeVisible, translateY, onShowComplete, onHideComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const dismiss = useCallback((): void => {
    setHomeVisible(false);
  }, [setHomeVisible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .onUpdate((event) => {
          'worklet';
          if (event.translationY > 0) {
            translateY.value = event.translationY;
          }
        })
        .onEnd((event) => {
          'worklet';
          if (event.translationY > DISMISS_THRESHOLD || event.velocityY > DISMISS_VELOCITY) {
            scheduleOnRN(dismiss);
          } else {
            translateY.value = withTiming(0, TIMING_CONFIG);
          }
        }),
    [translateY, dismiss]
  );

  const handlePlayPause = (): void => {
    if (isAnimatingRef.current) return;
    const stream = STREAMS[currentStreamIndex];
    if (stream === undefined) return;
    void haptics.medium();

    if (isPlaying) {
      // Pause — overlay stays open
      void togglePlayback();
    } else {
      // Play — close overlay and start/resume playback
      setHomeVisible(false);
      if (isCurrentStreamActive) {
        void togglePlayback();
      } else {
        void playStream(stream.url, stream.name);
      }
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        onLayout={handleLayout}
        pointerEvents={isFullyHidden ? 'none' : 'auto'}
        className="absolute inset-0 bg-black"
        // eslint-disable-next-line react-native/no-inline-styles
        style={[{ zIndex: 1 }, animatedStyle]}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          nativeControls={false}
          allowsVideoFrameAnalysis={false}
          allowsPictureInPicture={false}
        />
        <ScrollView
          contentContainerClassName="w-full items-center"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <View className="-mb-[134px] h-[50vh]" />
          <Pressable
            onPress={handlePlayPause}
            disabled={isLoading}
            className="relative items-center justify-center active:opacity-70"
          >
            <Image
              source={streamsLogo}
              // eslint-disable-next-line react-native/no-inline-styles
              style={{ width: 268, height: 268 }}
              contentFit="contain"
            />
            <View className="absolute items-center justify-center" pointerEvents="none">
              {isLoading ? (
                <Loader size={80} />
              ) : isPlaying ? (
                <PauseIcon size={80} color="white" />
              ) : (
                <PlayIcon size={80} color="white" />
              )}
            </View>
          </Pressable>
          <View className="mt-6 w-[268px] gap-3" style={{ filter: [{ grayscale: 1 }] }}>
            {CHANNEL_BLOCKS.map((source, index) => (
              <Image
                key={index}
                source={source}
                className="aspect-[686/360] w-full"
                contentFit="contain"
              />
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </GestureDetector>
  );
}
