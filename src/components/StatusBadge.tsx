import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STREAMS } from '@/config/streams';
import { isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import { WifiOffIcon } from './icons';
import { Text } from './ui';

export function StatusBadge(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const status = useAudioStore((s) => s.status);
  const currentStreamUrl = useAudioStore((s) => s.currentStreamUrl);
  const error = useAudioStore((s) => s.error);
  const playStream = useAudioStore((s) => s.playStream);
  const clearError = useAudioStore((s) => s.clearError);
  const currentStreamIndex = useAppStore((state) => state.currentStreamIndex);
  const isOffline: boolean = useAppStore((state) => state.isOffline);

  // Find the current stream based on index
  const currentStream = STREAMS[currentStreamIndex];

  const isCurrentStreamActive =
    currentStreamUrl !== null && currentStream !== undefined
      ? currentStreamUrl === currentStream.url
      : false;

  const isPlaying = status === 'playing' && isCurrentStreamActive;
  const isLoading = status === 'loading' && isCurrentStreamActive;
  const hasError = status === 'error' && isCurrentStreamActive;

  const handleRetry = (): void => {
    if (currentStream === undefined) return;
    clearError();
    void playStream(currentStream.url, currentStream.name);
  };

  const renderBadgeContent = (): React.ReactElement | null => {
    // Show offline status prominently
    if (isOffline) {
      return (
        <View className="flex-row items-center rounded-full bg-white/20 px-3 py-1">
          <WifiOffIcon size={12} color="#EF4444" />
          <Text size="xs" className="ml-1.5 font-heading uppercase tracking-wider text-red-400">
            offline
          </Text>
        </View>
      );
    }

    if (isExpoGo) {
      return (
        <View className="rounded-full bg-white/20 px-3 py-1">
          <Text size="xs" className="font-heading uppercase tracking-wider text-white/80">
            expo go - no audio
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View className="flex-row items-center rounded-full bg-white/20 px-3 py-1">
          <View className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-white/60" />
          <Text size="xs" className="font-heading uppercase tracking-wider text-white/80">
            connecting...
          </Text>
        </View>
      );
    }

    if (hasError) {
      return (
        <Pressable onPress={handleRetry}>
          <View className="rounded-full bg-white/20 px-3 py-1">
            <Text size="xs" className="font-heading uppercase tracking-wider text-red-500">
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
          <Text size="xs" className="font-heading uppercase tracking-wider text-white/80">
            now streaming
          </Text>
        </View>
      );
    }

    // Idle state - no badge shown
    return null;
  };

  const content = renderBadgeContent();

  if (content === null) {
    return null;
  }

  return (
    <View className="absolute left-4" style={{ top: insets.top + 16 }} pointerEvents="box-none">
      {content}
    </View>
  );
}
