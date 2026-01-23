import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { STREAMS, getDefaultStreamIndex } from '@/config/streams';
import { useAudioStore } from '@/store/audioStore';

import { ChannelScreen } from './ChannelScreen';
import { Text } from './ui';

export function SwipePager(): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(getDefaultStreamIndex);
  const { status, playStream } = useAudioStore();

  const goToIndex = useCallback(
    (newIndex: number): void => {
      let targetIndex = newIndex;
      if (newIndex < 0) {
        targetIndex = STREAMS.length - 1;
      } else if (newIndex >= STREAMS.length) {
        targetIndex = 0;
      }
      setCurrentIndex(targetIndex);

      // If music is playing, switch to the new stream
      const stream = STREAMS[targetIndex];
      if (status === 'playing' && stream !== undefined) {
        void playStream(stream.url, stream.name);
      }
    },
    [status, playStream]
  );

  const currentStream = STREAMS[currentIndex];
  if (currentStream === undefined) {
    return <View />;
  }

  return (
    <View className="relative flex-1">
      {/* Current screen - full screen */}
      <View className="flex-1">
        <ChannelScreen stream={currentStream} />
      </View>

      {/* Navigation Arrows */}
      <Pressable
        onPress={() => goToIndex(currentIndex - 1)}
        className="absolute left-4 top-1/2 h-12 w-12 -translate-y-6 items-center justify-center rounded-full bg-white/20 active:bg-white/40"
      >
        <Text className="text-xl text-white">←</Text>
      </Pressable>

      <Pressable
        onPress={() => goToIndex(currentIndex + 1)}
        className="absolute right-4 top-1/2 h-12 w-12 -translate-y-6 items-center justify-center rounded-full bg-white/20 active:bg-white/40"
      >
        <Text className="text-xl text-white">→</Text>
      </Pressable>

      {/* Dots Indicator */}
      <View className="absolute bottom-10 left-0 right-0 flex-row justify-center gap-2">
        {STREAMS.map((stream, index) => (
          <Pressable key={stream.id} onPress={() => goToIndex(index)}>
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: index === currentIndex ? 'white' : 'rgba(255,255,255,0.4)',
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
