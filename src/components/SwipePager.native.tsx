import { useCallback, useRef } from 'react';
import { Platform, View } from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

import { STREAMS, type StreamConfig, getDefaultStreamIndex } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { useAudioStore } from '@/store/audioStore';

import { ChannelScreen } from './ChannelScreen';

// For infinite scroll: [Blue, Red, Green, Blue, Red]
// We use non-null assertions here because we know STREAMS has 3 elements
const INFINITE_PAGES: StreamConfig[] = [
  STREAMS[2]!, // Blue (fake start) - page 0
  STREAMS[0]!, // Red - page 1
  STREAMS[1]!, // Green - page 2
  STREAMS[2]!, // Blue - page 3
  STREAMS[0]!, // Red (fake end) - page 4
];

// Map stream index to page index in INFINITE_PAGES
// Red (0) → page 1, Green (1) → page 2, Blue (2) → page 3
function getInitialPage(): number {
  const streamIndex = getDefaultStreamIndex();
  return streamIndex + 1; // +1 because page 0 is the fake Blue start
}

export function SwipePager(): React.ReactElement {
  const pagerRef = useRef<PagerView>(null);
  const haptics = useHaptics();
  const { status, playStream } = useAudioStore();
  const initialPage = getInitialPage();

  const handlePageSelected = useCallback(
    async (event: PagerViewOnPageSelectedEvent): Promise<void> => {
      const position = event.nativeEvent.position;

      // Trigger haptic feedback (native only)
      if (Platform.OS !== 'web') {
        await haptics.medium();
      }

      // Handle infinite scroll boundaries
      if (position === 0) {
        pagerRef.current?.setPageWithoutAnimation(3);
      } else if (position === 4) {
        pagerRef.current?.setPageWithoutAnimation(1);
      }

      // If music is playing, switch to the new stream
      const stream = INFINITE_PAGES[position];
      if (status === 'playing' && stream !== undefined) {
        void playStream(stream.url, stream.name);
      }
    },
    [haptics, status, playStream]
  );

  return (
    <PagerView
      ref={pagerRef}
      style={{ flex: 1 }}
      initialPage={initialPage}
      onPageSelected={(e) => void handlePageSelected(e)}
      overdrag={true}
    >
      {INFINITE_PAGES.map((stream, index) => (
        <View key={`${stream.id}-${String(index)}`} style={{ flex: 1 }}>
          <ChannelScreen stream={stream} />
        </View>
      ))}
    </PagerView>
  );
}
