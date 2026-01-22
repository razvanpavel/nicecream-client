import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StreamConfig } from '@/config/streams';
import { isExpoGo } from '@/services/audioService';
import { useAudioStore } from '@/store/audioStore';

import { Text } from './ui';

interface ChannelScreenProps {
  stream: StreamConfig;
}

export function ChannelScreen({ stream }: ChannelScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const { isPlaying, togglePlayback, streamMetadata } = useAudioStore();

  const handlePlayPause = (): void => {
    void togglePlayback();
  };

  return (
    <View
      style={{ backgroundColor: stream.backgroundColor, paddingTop: insets.top }}
      className="flex-1 items-center justify-center"
    >
      {/* Expo Go Indicator */}
      {isExpoGo && (
        <View className="absolute left-4 top-4" style={{ marginTop: insets.top }}>
          <View className="rounded-full bg-yellow-500 px-3 py-1">
            <Text size="xs" className="font-medium text-white">
              Expo Go - No Audio
            </Text>
          </View>
        </View>
      )}

      {/* Station Name */}
      <View className="mb-8">
        <Text
          variant="heading"
          size="3xl"
          style={{ color: stream.color }}
          className="text-center"
        >
          {stream.name}
        </Text>
      </View>

      {/* Now Playing Info */}
      <View className="mb-12 px-8">
        {streamMetadata?.title !== undefined && streamMetadata.title !== '' ? (
          <>
            <Text variant="muted" className="mb-1 text-center">
              Now Playing
            </Text>
            <Text variant="subheading" size="lg" className="text-center">
              {streamMetadata.title}
            </Text>
            {streamMetadata.artist !== undefined && streamMetadata.artist !== '' && (
              <Text variant="muted" className="mt-1 text-center">
                {streamMetadata.artist}
              </Text>
            )}
          </>
        ) : (
          <Text variant="muted" className="text-center">
            {isExpoGo ? 'Audio requires development build' : 'Live Stream'}
          </Text>
        )}
      </View>

      {/* Play/Pause Button */}
      <Pressable
        onPress={handlePlayPause}
        style={{ backgroundColor: stream.color }}
        className="h-20 w-20 items-center justify-center rounded-full"
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={40}
          color="white"
          style={{ marginLeft: isPlaying ? 0 : 4 }}
        />
      </Pressable>

      {/* Swipe Indicators */}
      <View
        style={{ paddingBottom: insets.bottom + 20 }}
        className="absolute bottom-0 w-full flex-row items-center justify-center"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="chevron-back" size={16} color={stream.color} />
          <Text variant="muted" size="sm">
            Swipe to change station
          </Text>
          <Ionicons name="chevron-forward" size={16} color={stream.color} />
        </View>
      </View>
    </View>
  );
}
