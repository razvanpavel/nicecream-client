import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StreamConfig } from '@/config/streams';
import { isExpoGo } from '@/services/audioService';
import { useAudioStore } from '@/store/audioStore';

import { Text } from './ui';

interface ChannelScreenProps {
  stream: StreamConfig;
}

export function ChannelScreen({ stream }: ChannelScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { status, currentStreamUrl, error, togglePlayback, playStream, clearError } =
    useAudioStore();

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

  const isWeb = Platform.OS === 'web';

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{
        backgroundColor: stream.color,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Status Badge */}
      <View className="absolute left-4" style={{ top: insets.top + 16 }}>
        {isExpoGo ? (
          <View className="rounded-full bg-white/20 px-3 py-1">
            <Text size="xs" className="text-white">
              Expo Go - No Audio
            </Text>
          </View>
        ) : isPlaying ? (
          <View className="flex-row items-center rounded-full bg-white/20 px-3 py-1">
            <View className="mr-1.5 h-2 w-2 rounded-full bg-white" />
            <Text size="xs" className="text-white">
              LIVE
            </Text>
          </View>
        ) : null}
      </View>

      {/* Station Name - Large heading, lowercase */}
      <Text className="mb-4 text-center font-heading text-10xl lowercase text-white md:text-16xl">
        {stream.name}
      </Text>

      {/* Status Text */}
      <View className="mb-8 h-6">
        {isLoading && <Text className="text-center text-white/80">connecting to stream...</Text>}
        {hasError && (
          <Pressable onPress={handleRetry}>
            <Text className="text-center text-white/80">
              {error ?? 'connection failed'} • tap to retry
            </Text>
          </Pressable>
        )}
        {!isLoading && !hasError && (
          <Text className="text-center text-white/80">
            {isPlaying ? 'now streaming' : 'tap to play'}
          </Text>
        )}
      </View>

      {/* Play/Pause Button - White */}
      <Pressable onPress={handlePlayPause} disabled={isLoading}>
        <View className="h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg">
          {isLoading ? (
            <ActivityIndicator size="large" color={stream.color} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={48} color={stream.color} />
          )}
        </View>
      </Pressable>

      {/* Volume/Wave Animation (when playing) */}
      {isPlaying && (
        <View className="mt-6 flex-row items-end justify-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="w-1 rounded-sm bg-white/60"
              style={{ height: 8 + Math.random() * 16 }}
            />
          ))}
        </View>
      )}

      {/* Swipe Hint - only on mobile */}
      {!isWeb && (
        <View
          className="absolute left-0 right-0 items-center"
          style={{ bottom: insets.bottom + 24 }}
        >
          <View className="flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-2">
            <Ionicons name="chevron-back" size={14} color="white" />
            <Text className="text-sm text-white/80">swipe for more stations</Text>
            <Ionicons name="chevron-forward" size={14} color="white" />
          </View>
        </View>
      )}
    </View>
  );
}
