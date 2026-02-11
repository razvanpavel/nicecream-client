import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import PagerView, {
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEvent,
} from 'react-native-pager-view';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CHANNEL_LOGOS } from '@/config/logos';
import { STREAMS, type StreamConfig, getDefaultStreamIndex } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppStore, type ChannelId } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import { ChannelScreen } from './ChannelScreen';
// import { StatusBadge } from './StatusBadge';

const CHANNEL_IDS: ChannelId[] = ['red', 'green', 'blue'];

const TIMING_CONFIG = { duration: 100, easing: Easing.inOut(Easing.ease) };

function CrossfadeLogo({
  channelId,
  activeIndex,
}: {
  channelId: ChannelId;
  activeIndex: SharedValue<number>;
}): React.ReactElement {
  const targetIndex = CHANNEL_IDS.indexOf(channelId);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeIndex.value === targetIndex ? 1 : 0, TIMING_CONFIG),
  }));

  return (
    <Animated.View style={[{ position: 'absolute', width: 268, height: 268 }, animatedStyle]}>
      <Image
        source={CHANNEL_LOGOS[channelId]}
        style={{ width: 268, height: 268 }}
        contentFit="contain"
      />
    </Animated.View>
  );
}

// For infinite scroll: [Blue, Red, Green, Blue, Red]
// Build pages using indices - STREAMS array has exactly 3 elements [red, green, blue]
function buildInfinitePages(): StreamConfig[] {
  const red = STREAMS[0];
  const green = STREAMS[1];
  const blue = STREAMS[2];

  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error('STREAMS array must have exactly 3 elements');
  }

  return [
    blue, // Blue (fake start) - page 0
    red, // Red - page 1
    green, // Green - page 2
    blue, // Blue - page 3
    red, // Red (fake end) - page 4
  ];
}

const INFINITE_PAGES: StreamConfig[] = buildInfinitePages();

// Map stream index to page index in INFINITE_PAGES
// Red (0) → page 1, Green (1) → page 2, Blue (2) → page 3
function getInitialPage(): number {
  const streamIndex = getDefaultStreamIndex();
  return streamIndex + 1; // +1 because page 0 is the fake Blue start
}

// Map page position to stream index
// Pages: [Blue(0), Red(1), Green(2), Blue(3), Red(4)]
// Streams: Red=0, Green=1, Blue=2
function pageToStreamIndex(position: number): number {
  if (position === 0 || position === 3) return 2; // Blue
  if (position === 1 || position === 4) return 0; // Red
  return 1; // Green (position === 2)
}

export function SwipePager(): React.ReactElement {
  const pagerRef = useRef<PagerView>(null);
  const haptics = useHaptics();
  const playStream = useAudioStore((state) => state.playStream);
  const setCurrentStreamIndex = useAppStore((state) => state.setCurrentStreamIndex);
  const initialPage = getInitialPage();
  // Track which page is currently visible (for video pause/play)
  const [activePage, setActivePage] = useState(initialPage);
  // Shared value for crossfade logo animation
  const activeStreamIndex = useSharedValue(pageToStreamIndex(initialPage));
  // Track programmatic jumps to avoid duplicate stream switches
  const isJumpingRef = useRef(false);
  // Track current page for navigation
  const currentPageRef = useRef(initialPage);

  // Trigger haptic when swipe starts settling (before animation completes)
  const handlePageScrollStateChanged = useCallback(
    (event: PageScrollStateChangedNativeEvent): void => {
      const state = event.nativeEvent.pageScrollState;

      // 'settling' = user lifted finger, animation starting
      if (state === 'settling' && !isJumpingRef.current) {
        void haptics.medium();
      }
    },
    [haptics]
  );

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent): void => {
      const position = event.nativeEvent.position;
      currentPageRef.current = position;

      // If this event is from a programmatic jump (setPageWithoutAnimation),
      // we've already handled the stream switch - just update refs and return
      if (isJumpingRef.current) {
        isJumpingRef.current = false;
        return;
      }

      // Determine the effective stream position
      // For boundaries, this is the "real" page we're jumping to
      let effectivePosition = position;
      let needsJump = false;

      if (position === 0) {
        // Blue boundary -> will jump to page 3 (Blue)
        effectivePosition = 3;
        needsJump = true;
      } else if (position === 4) {
        // Red boundary -> will jump to page 1 (Red)
        effectivePosition = 1;
        needsJump = true;
      }

      // Update active page for video pause/play control
      setActivePage(effectivePosition);

      // Sync stream index for logo (always based on effective position)
      const streamIndex = pageToStreamIndex(effectivePosition);
      setCurrentStreamIndex(streamIndex);

      // Switch stream - audioStore handles cancellation internally
      const { status } = useAudioStore.getState();
      const stream = INFINITE_PAGES[effectivePosition];

      if ((status === 'playing' || status === 'loading') && stream !== undefined) {
        void playStream(stream.url, stream.name);
      }

      // Perform the visual jump AFTER initiating stream switch
      if (needsJump) {
        isJumpingRef.current = true;
        pagerRef.current?.setPageWithoutAnimation(effectivePosition);
        currentPageRef.current = effectivePosition;
      }
    },
    [playStream, setCurrentStreamIndex]
  );

  // Sync crossfade logo with active page
  useEffect(() => {
    activeStreamIndex.value = pageToStreamIndex(activePage);
  }, [activePage, activeStreamIndex]);

  // Consume navigation signals from appStore (sent by BottomNavigation)
  const pendingNavigation = useAppStore((s) => s.pendingNavigation);
  const clearPendingNavigation = useAppStore((s) => s.clearPendingNavigation);

  useEffect(() => {
    if (pendingNavigation === null) return;

    if (pendingNavigation === 'prev') {
      const prevPage = currentPageRef.current - 1;
      pagerRef.current?.setPage(Math.max(0, prevPage));
    } else {
      const nextPage = currentPageRef.current + 1;
      pagerRef.current?.setPage(Math.min(INFINITE_PAGES.length - 1, nextPage));
    }

    clearPendingNavigation();
  }, [pendingNavigation, clearPendingNavigation]);

  return (
    <View className="flex-1">
      <PagerView
        ref={pagerRef}
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ flex: 1 }}
        initialPage={initialPage}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        overdrag={true}
      >
        {INFINITE_PAGES.map((stream, index) => (
          <View key={`${stream.id}-${String(index)}`} className="flex-1">
            <ChannelScreen stream={stream} isActive={index === activePage} showLogo={false} />
          </View>
        ))}
      </PagerView>

      {/* Fixed crossfade logo overlay */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        {CHANNEL_IDS.map((id) => (
          <CrossfadeLogo key={id} channelId={id} activeIndex={activeStreamIndex} />
        ))}
      </View>

      {/* Fixed Status Badge */}
      {/* <StatusBadge /> */}
    </View>
  );
}
