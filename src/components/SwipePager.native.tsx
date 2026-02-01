import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import PagerView, {
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEvent,
} from 'react-native-pager-view';

import { STREAMS, type StreamConfig, getDefaultStreamIndex } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import { BottomNavigation } from './BottomNavigation';
import { ChannelScreen } from './ChannelScreen';
import { StatusBadge } from './StatusBadge';

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
  const currentStreamIndex = useAppStore((state) => state.currentStreamIndex);
  const initialPage = getInitialPage();
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

      // If this is from a programmatic jump, skip stream switching logic
      if (isJumpingRef.current) {
        isJumpingRef.current = false;
        return;
      }

      // Sync stream index for background image hook
      const streamIndex = pageToStreamIndex(position);
      setCurrentStreamIndex(streamIndex);

      // Handle infinite scroll boundaries
      if (position === 0) {
        isJumpingRef.current = true;
        pagerRef.current?.setPageWithoutAnimation(3);
        currentPageRef.current = 3;
        // Switch to the actual stream (Blue at page 3)
        const stream = INFINITE_PAGES[3];
        const currentStatus = useAudioStore.getState().status;
        if ((currentStatus === 'playing' || currentStatus === 'loading') && stream !== undefined) {
          void playStream(stream.url, stream.name);
        }
        return;
      } else if (position === 4) {
        isJumpingRef.current = true;
        pagerRef.current?.setPageWithoutAnimation(1);
        currentPageRef.current = 1;
        // Switch to the actual stream (Red at page 1)
        const stream = INFINITE_PAGES[1];
        const currentStatus = useAudioStore.getState().status;
        if ((currentStatus === 'playing' || currentStatus === 'loading') && stream !== undefined) {
          void playStream(stream.url, stream.name);
        }
        return;
      }

      // Get fresh status from store (not from closure)
      const currentStatus = useAudioStore.getState().status;

      // If music is playing or loading, switch to the new stream
      const stream = INFINITE_PAGES[position];
      if ((currentStatus === 'playing' || currentStatus === 'loading') && stream !== undefined) {
        void playStream(stream.url, stream.name);
      }
    },
    [playStream, setCurrentStreamIndex]
  );

  const handlePrevious = useCallback((): void => {
    // Map current stream index to page, then go to previous
    // Stream indices: Red=0, Green=1, Blue=2
    // Pages: Red=1, Green=2, Blue=3
    const currentPage = currentStreamIndex + 1;
    const prevPage = currentPage - 1;
    pagerRef.current?.setPage(prevPage);
  }, [currentStreamIndex]);

  const handleNext = useCallback((): void => {
    const currentPage = currentStreamIndex + 1;
    const nextPage = currentPage + 1;
    pagerRef.current?.setPage(nextPage);
  }, [currentStreamIndex]);

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
            <ChannelScreen stream={stream} />
          </View>
        ))}
      </PagerView>

      {/* Fixed Status Badge */}
      <StatusBadge />

      {/* Fixed Bottom Navigation */}
      <BottomNavigation onPrevious={handlePrevious} onNext={handleNext} />
    </View>
  );
}
