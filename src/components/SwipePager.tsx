import { useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

import { STREAMS } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { useAudioStore } from '@/store/audioStore';

import { ChannelScreen } from './ChannelScreen';

// For infinite scroll: [Blue, Red, Green, Blue, Red]
const INFINITE_PAGES = [
  STREAMS[2], // Blue (fake start)
  STREAMS[0], // Red
  STREAMS[1], // Green (default - index 2)
  STREAMS[2], // Blue
  STREAMS[0], // Red (fake end)
];

export function SwipePager(): JSX.Element {
  const pagerRef = useRef<PagerView>(null);
  const playIcecastStream = useAudioStore((state) => state.playIcecastStream);
  const haptics = useHaptics();

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

      // Play the stream for current page
      const stream = INFINITE_PAGES[position];
      if (stream !== undefined) {
        await playIcecastStream(stream.url, stream.name);
      }
    },
    [playIcecastStream, haptics]
  );

  return (
    <PagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={2} // Green (center)
      onPageSelected={(e) => void handlePageSelected(e)}
      overdrag={true}
    >
      {INFINITE_PAGES.map((stream, index) => (
        <View key={`${stream.id}-${String(index)}`} style={styles.page}>
          <ChannelScreen stream={stream} />
        </View>
      ))}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  page: { flex: 1 },
});
