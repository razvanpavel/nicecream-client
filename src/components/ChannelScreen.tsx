import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StreamConfig } from '@/config/streams';
import { isExpoGo } from '@/services/audioService';
import { type ChannelId } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import { BackgroundImage } from './BackgroundImage';
import { Text } from './ui';

interface ChannelScreenProps {
  stream: StreamConfig;
}

export function ChannelScreen({ stream }: ChannelScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { status, currentStreamUrl, error, playStream, clearError } = useAudioStore();

  const isThisStreamActive = currentStreamUrl === stream.url;
  const isPlaying = status === 'playing' && isThisStreamActive;
  const isLoading = status === 'loading' && isThisStreamActive;
  const hasError = status === 'error' && isThisStreamActive;

  const handleRetry = (): void => {
    clearError();
    void playStream(stream.url, stream.name);
  };

  const channelId = stream.id as ChannelId;

  // Determine status badge content
  const renderStatusBadge = (): React.ReactElement | null => {
    if (isExpoGo) {
      return (
        <View className="rounded-full bg-white/20 px-3 py-1">
          <Text size="xs" className="text-white">
            expo go - no audio
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View className="flex-row items-center rounded-full bg-white/20 px-3 py-1">
          <View className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-white/60" />
          <Text size="xs" className="text-white">
            connecting...
          </Text>
        </View>
      );
    }

    if (hasError) {
      return (
        <Pressable onPress={handleRetry}>
          <View className="rounded-full bg-white/20 px-3 py-1">
            <Text size="xs" className="text-white">
              {error?.message ?? 'error'} • tap to retry
            </Text>
          </View>
        </Pressable>
      );
    }

    if (isPlaying) {
      return (
        <View className="flex-row items-center rounded-full bg-white/20 px-3 py-1">
          <View className="mr-1.5 h-2 w-2 rounded-full bg-white" />
          <Text size="xs" className="text-white">
            now streaming
          </Text>
        </View>
      );
    }

    // Idle state - no badge shown
    return null;
  };

  return (
    <View className="flex-1" style={{ backgroundColor: stream.color }}>
      {/* Background Image Layer */}
      <BackgroundImage channel={channelId} />

      {/* Subtle overlay for text legibility */}
      <View className="absolute inset-0 bg-black/5" pointerEvents="none" />

      {/* Content Layer */}
      <View
        className="flex-1 items-center justify-center"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 100, // Extra space for bottom navigation
        }}
      >
        {/* Status Badge - Top Left */}
        <View className="absolute left-4" style={{ top: insets.top + 16 }}>
          {renderStatusBadge()}
        </View>

        {/* Station Name - Large heading, lowercase */}
        <Text className="text-center font-heading text-10xl lowercase text-white md:text-12xl lg:text-16xl">
          {stream.name}
        </Text>
      </View>
    </View>
  );
}
