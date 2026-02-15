import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { STREAMS } from '@/config/streams';
import { isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';
import { cn } from '@/utils/cn';

import { AppStoreBadge, PauseIcon, PlayIcon } from './icons';
import { Loader } from './Loader';
import { Text } from './ui';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const streamsLogo = require('../../assets/images/logos/streams.png') as number;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const introVideo = require('../../assets/images/backgrounds/intro.mp4') as number;

// /* eslint-disable @typescript-eslint/no-require-imports */
// const CHANNEL_BLOCKS = [
//   require('../../assets/images/logos/channel-watermelon.png') as number,
//   require('../../assets/images/logos/channel-niteride.png') as number,
//   require('../../assets/images/logos/channel-workit.png') as number,
//   require('../../assets/images/logos/channel-suntrack.png') as number,
//   require('../../assets/images/logos/channel-chill.png') as number,
// ];
// /* eslint-enable @typescript-eslint/no-require-imports */

const LOGO_SIZE = 268;
const ANIMATION_DURATION = 400;

export function HomeOverlay(): React.ReactElement | null {
  const isHomeVisible = useAppStore((s) => s.isHomeVisible);
  const setHomeVisible = useAppStore((s) => s.setHomeVisible);
  const setHomeFullyHidden = useAppStore((s) => s.setHomeFullyHidden);
  const currentStreamIndex = useAppStore((s) => s.currentStreamIndex);
  const isPlayerSetup = useAppStore((s) => s.isPlayerSetup);
  const status = useAudioStore((s) => s.status);
  const currentStreamUrl = useAudioStore((s) => s.currentStreamUrl);
  const togglePlayback = useAudioStore((s) => s.togglePlayback);
  const playStream = useAudioStore((s) => s.playStream);

  const [isMounted, setIsMounted] = useState(isHomeVisible);
  const [isShowing, setIsShowing] = useState(isHomeVisible);
  const isAnimatingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Intro video background
  const player = useVideoPlayer(introVideo, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const isMountedRef = useRef(isMounted);

  useEffect(() => {
    isMountedRef.current = isMounted;
  }, [isMounted]);

  // Pause/play video based on overlay mount state
  useEffect(() => {
    if (isMounted) {
      player.play();
    } else {
      player.pause();
    }
  }, [isMounted, player]);

  // Pause/play video on tab visibility change
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        player.pause();
      } else if (isMountedRef.current) {
        player.play();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // Escape key dismisses overlay
  useEffect(() => {
    if (!isHomeVisible) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setHomeVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHomeVisible, setHomeVisible]);

  // Synchronous state updates during render to avoid setState-in-effect lint errors
  if (isHomeVisible && !isMounted) {
    setIsMounted(true);
  }
  if (!isHomeVisible && isShowing) {
    setIsShowing(false);
  }

  // Handle CSS transition timing via async callbacks
  useEffect(() => {
    if (isHomeVisible) {
      // Reset scroll position when overlay opens
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      // Small delay to ensure DOM is mounted before triggering CSS transition
      const showTimer = setTimeout(() => {
        setIsShowing(true);
        isAnimatingRef.current = false;
      }, 10);
      return (): void => {
        clearTimeout(showTimer);
      };
    } else {
      // Start hide animation
      isAnimatingRef.current = true;
      // Wait for slide-down animation to finish before unmounting
      const hideTimer = setTimeout(() => {
        setIsMounted(false);
        isAnimatingRef.current = false;
        setHomeFullyHidden(true);
      }, ANIMATION_DURATION);
      return (): void => {
        clearTimeout(hideTimer);
      };
    }
  }, [isHomeVisible]);

  const handlePlayPause = useCallback((): void => {
    if (isAnimatingRef.current) return;
    const stream = STREAMS[currentStreamIndex];
    if (stream === undefined) return;

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
  }, [
    currentStreamIndex,
    isPlaying,
    isCurrentStreamActive,
    setHomeVisible,
    togglePlayback,
    playStream,
  ]);

  if (!isMounted) return null;

  return (
    <View
      pointerEvents={isHomeVisible ? 'auto' : 'none'}
      className={cn(
        'absolute inset-0 bg-black transition-transform',
        isShowing ? '' : 'translate-y-full'
      )}
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        zIndex: 1,
        transitionDuration: `${String(ANIMATION_DURATION)}ms`,
      }}
    >
      <View style={videoStyles.container} pointerEvents="none">
        <VideoView
          player={player}
          style={videoStyles.video}
          contentFit="cover"
          nativeControls={false}
          allowsVideoFrameAnalysis={false}
          allowsPictureInPicture={false}
        />
      </View>
      <View className="absolute left-0 right-0 top-0 z-10 items-center pt-10">
        <Text className="font-heading text-4xl uppercase leading-none text-white">get</Text>
        <Text className="font-heading text-4xl uppercase leading-none text-white">the</Text>
        <Text className="mb-5 font-heading text-4xl uppercase leading-none text-white">app</Text>
        <Pressable
          onPress={(): void => {
            void Linking.openURL('https://apps.apple.com/app/nicecream-fm/id6746425750');
          }}
        >
          <AppStoreBadge width={120} height={40} />
        </Pressable>
      </View>
      <ScrollView
        ref={scrollViewRef}
        contentContainerClassName="w-full items-center"
        showsVerticalScrollIndicator={false}
      >
        {/* 134 = LOGO_SIZE / 2, centers logo at 50vh */}
        <Pressable
          className="h-[calc(50vh-134px)] w-full"
          onPress={(): void => {
            setHomeVisible(false);
          }}
        />
        <Pressable
          onPress={handlePlayPause}
          disabled={isLoading}
          className="relative items-center justify-center active:opacity-70"
        >
          <Image
            source={streamsLogo}
            style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
            contentFit="contain"
          />
          <View className="absolute items-center justify-center" pointerEvents="none">
            {isLoading ? (
              <Loader size={104} />
            ) : isPlaying ? (
              <PauseIcon size={104} color="white" />
            ) : (
              <PlayIcon size={104} color="white" />
            )}
          </View>
        </Pressable>
        <Text className="mt-12 text-center font-heading text-xl font-bold uppercase text-white">
          More channels coming soon
        </Text>
        <Pressable
          onPress={(): void => {
            void Linking.openURL('mailto:hi@nicecream.fm');
          }}
          className="active:opacity-70"
        >
          <Text className="text-center font-heading text-xl font-bold uppercase text-white">
            say,{' '}
            <Text className="font-heading text-xl font-bold text-white underline">
              hi@nicecream.fm
            </Text>
          </Text>
        </Pressable>
        {/* <View className="mt-10 gap-6 grayscale" style={{ width: LOGO_SIZE }}>
          {CHANNEL_BLOCKS.map((source, index) => (
            <Image
              key={index}
              source={source}
              className="aspect-[686/360] w-full"
              contentFit="contain"
            />
          ))}
        </View> */}
        {/* <Pressable
          className="h-[50vh] w-full"
          onPress={(): void => {
            setHomeVisible(false);
          }}
        /> */}
      </ScrollView>
    </View>
  );
}

const videoStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
