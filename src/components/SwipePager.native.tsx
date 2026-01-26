import { useCallback, useRef } from 'react';
import { Platform, View } from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

import { STREAMS, type StreamConfig, getDefaultStreamIndex } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { useAudioStore } from '@/store/audioStore';

import { ChannelScreen } from './ChannelScreen';

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

export function SwipePager(): React.ReactElement {
  const pagerRef = useRef<PagerView>(null);
  const haptics = useHaptics();
  const playStream = useAudioStore((state) => state.playStream);
  const initialPage = getInitialPage();
  // Track programmatic jumps to avoid duplicate stream switches
  const isJumpingRef = useRef(false);

  const handlePageSelected = useCallback(
    async (event: PagerViewOnPageSelectedEvent): Promise<void> => {
      const position = event.nativeEvent.position;

      // If this is from a programmatic jump, skip stream switching logic
      if (isJumpingRef.current) {
        isJumpingRef.current = false;
        return;
      }

      // Trigger haptic feedback (native only)
      if (Platform.OS !== 'web') {
        await haptics.medium();
      }

      // Handle infinite scroll boundaries
      if (position === 0) {
        isJumpingRef.current = true;
        pagerRef.current?.setPageWithoutAnimation(3);
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
    [haptics, playStream]
  );

  return (
    <PagerView
      ref={pagerRef}
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ flex: 1 }}
      initialPage={initialPage}
      onPageSelected={(e) => {
        void handlePageSelected(e);
      }}
      overdrag={true}
    >
      {INFINITE_PAGES.map((stream, index) => (
        <View key={`${stream.id}-${String(index)}`} className="flex-1">
          <ChannelScreen stream={stream} />
        </View>
      ))}
    </PagerView>
  );
}
