import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
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
  const {
    status,
    currentStreamUrl,
    error,
    togglePlayback,
    playStream,
    clearError,
  } = useAudioStore();

  const isThisStreamActive = currentStreamUrl === stream.url;
  const isPlaying = status === 'playing' && isThisStreamActive;
  const isLoading = status === 'loading' && isThisStreamActive;
  const hasError = status === 'error' && isThisStreamActive;

  const handlePlayPause = (): void => {
    if (isThisStreamActive) {
      void togglePlayback();
    } else {
      void playStream(stream.url, stream.name);
    }
  };

  const handleRetry = (): void => {
    clearError();
    void playStream(stream.url, stream.name);
  };

  return (
    <View
      style={{ backgroundColor: stream.backgroundColor, paddingTop: insets.top }}
      className="flex-1 items-center justify-center"
    >
      {/* Status Badge */}
      <View className="absolute left-4 top-4" style={{ marginTop: insets.top }}>
        {isExpoGo ? (
          <View className="rounded-full bg-yellow-500 px-3 py-1">
            <Text size="xs" className="font-medium text-white">
              Expo Go - No Audio
            </Text>
          </View>
        ) : isPlaying ? (
          <View className="flex-row items-center rounded-full bg-green-500 px-3 py-1">
            <View className="mr-1.5 h-2 w-2 rounded-full bg-white" />
            <Text size="xs" className="font-medium text-white">
              LIVE
            </Text>
          </View>
        ) : null}
      </View>

      {/* Station Name */}
      <View className="mb-4">
        <Text
          variant="heading"
          size="3xl"
          style={{ color: stream.color }}
          className="text-center"
        >
          {stream.name}
        </Text>
      </View>

      {/* Status Text */}
      <View className="mb-8 h-6">
        {isLoading && (
          <Text variant="muted" className="text-center">
            Connecting to stream...
          </Text>
        )}
        {hasError && (
          <Pressable onPress={handleRetry}>
            <Text className="text-center text-red-500">
              {error ?? 'Connection failed'} • Tap to retry
            </Text>
          </Pressable>
        )}
        {!isLoading && !hasError && (
          <Text variant="muted" className="text-center">
            {isPlaying ? 'Now streaming' : 'Tap to play'}
          </Text>
        )}
      </View>

      {/* Play/Pause Button */}
      <Pressable
        onPress={handlePlayPause}
        disabled={isLoading}
        style={({ pressed }) => ({
          backgroundColor: pressed ? adjustColor(stream.color, -20) : stream.color,
          opacity: isLoading ? 0.7 : 1,
        })}
        className="h-24 w-24 items-center justify-center rounded-full shadow-lg"
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="white" />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={48}
            color="white"
            style={{ marginLeft: isPlaying ? 0 : 6 }}
          />
        )}
      </Pressable>

      {/* Volume/Wave Animation (when playing) */}
      {isPlaying && (
        <View className="mt-6 flex-row items-end justify-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: stream.color,
                opacity: 0.6,
                width: 4,
                height: 8 + Math.random() * 16,
                borderRadius: 2,
              }}
            />
          ))}
        </View>
      )}

      {/* Swipe Hint */}
      <View
        style={{ paddingBottom: insets.bottom + 24 }}
        className="absolute bottom-0 w-full items-center"
      >
        <View className="flex-row items-center gap-2 rounded-full bg-black/10 px-4 py-2">
          <Ionicons name="chevron-back" size={14} color={stream.color} />
          <Text variant="muted" size="sm">
            Swipe for more stations
          </Text>
          <Ionicons name="chevron-forward" size={14} color={stream.color} />
        </View>
      </View>
    </View>
  );
}

// Helper to darken/lighten a hex color
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
