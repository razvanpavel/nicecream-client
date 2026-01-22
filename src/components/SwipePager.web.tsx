import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { STREAMS, DEFAULT_STREAM_INDEX } from '@/config/streams';

import { ChannelScreen } from './ChannelScreen';
import { Text } from './ui';

export function SwipePager(): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(DEFAULT_STREAM_INDEX);

  // NOTE: We intentionally don't auto-play audio on navigation.
  // User must tap play button to start audio (UX best practice + browser autoplay policy)
  const goToStream = useCallback((index: number): void => {
    setCurrentIndex(index);
  }, []);

  const goLeft = useCallback((): void => {
    const newIndex = currentIndex === 0 ? STREAMS.length - 1 : currentIndex - 1;
    goToStream(newIndex);
  }, [currentIndex, goToStream]);

  const goRight = useCallback((): void => {
    const newIndex = currentIndex === STREAMS.length - 1 ? 0 : currentIndex + 1;
    goToStream(newIndex);
  }, [currentIndex, goToStream]);

  const currentStream = STREAMS[currentIndex];

  if (currentStream === undefined) {
    return <View />;
  }

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <ChannelScreen stream={currentStream} />

      {/* Navigation Arrows */}
      <Pressable
        onPress={goLeft}
        style={({ pressed }) => ({
          position: 'absolute',
          left: 20,
          top: '50%',
          transform: [{ translateY: -25 }],
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: pressed ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
        })}
      >
        <Text style={{ color: 'white', fontSize: 24 }}>←</Text>
      </Pressable>

      <Pressable
        onPress={goRight}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          top: '50%',
          transform: [{ translateY: -25 }],
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: pressed ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
        })}
      >
        <Text style={{ color: 'white', fontSize: 24 }}>→</Text>
      </Pressable>

      {/* Dots Indicator */}
      <View
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {STREAMS.map((stream, index) => (
          <Pressable key={stream.id} onPress={() => goToStream(index)}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor:
                  index === currentIndex ? stream.color : 'rgba(0,0,0,0.2)',
                borderWidth: index === currentIndex ? 0 : 1,
                borderColor: 'rgba(0,0,0,0.1)',
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
