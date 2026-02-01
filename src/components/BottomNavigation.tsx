import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STREAMS } from '@/config/streams';
import { isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';
import { Text } from './ui';

interface BottomNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
}

export function BottomNavigation({
  onPrevious,
  onNext,
}: BottomNavigationProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { status, currentStreamUrl, streamMetadata, togglePlayback, playStream } = useAudioStore();
  const isPlayerSetup = useAppStore((state) => state.isPlayerSetup);
  const currentStreamIndex = useAppStore((state) => state.currentStreamIndex);

  // Find the current stream based on index
  const currentStream = STREAMS[currentStreamIndex];

  const isCurrentStreamActive =
    currentStreamUrl !== null && currentStream !== undefined
      ? currentStreamUrl === currentStream.url
      : false;
  const isPlaying = status === 'playing' && isCurrentStreamActive;
  const isLoading =
    (status === 'loading' && isCurrentStreamActive) || (!isPlayerSetup && !isExpoGo);

  const handlePlayPause = (): void => {
    if (currentStream === undefined) return;

    if (isCurrentStreamActive) {
      void togglePlayback();
    } else {
      void playStream(currentStream.url, currentStream.name);
    }
  };

  const handlePrevious = (): void => {
    onPrevious?.();
  };

  const handleNext = (): void => {
    onNext?.();
  };

  // Show track info only when playing and metadata is available
  const showTrackInfo = isPlaying && streamMetadata !== null;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 items-center justify-center"
      style={{ paddingBottom: insets.bottom + 16 }}
      pointerEvents="box-none"
    >
      {/* Track Info */}
      {showTrackInfo && (
        <View className="mb-6 items-center px-8">
          {streamMetadata.title != null && streamMetadata.title !== '-' && (
            <Text
              className="text-center font-heading text-lg uppercase text-white"
              numberOfLines={1}
            >
              {streamMetadata.title}
            </Text>
          )}
          {streamMetadata.artist != null && streamMetadata.artist !== '-' && (
            <Text
              className="text-center font-body text-base uppercase text-white/90"
              numberOfLines={1}
            >
              {streamMetadata.artist}
            </Text>
          )}
        </View>
      )}

      {/* Playback Controls */}
      <View className="flex-row items-center justify-center gap-4">
        {/* Previous Button */}
        <Pressable
          onPress={handlePrevious}
          className="h-14 w-14 items-center justify-center active:opacity-70"
        >
          <PrevIcon size={56} color="white" />
        </Pressable>

        {/* Play/Pause Button */}
        <Pressable
          onPress={handlePlayPause}
          disabled={isLoading}
          className="h-16 w-16 items-center justify-center active:opacity-70"
        >
          {isLoading ? (
            <ActivityIndicator size="large" color="white" />
          ) : isPlaying ? (
            <PauseIcon size={64} color="white" />
          ) : (
            <PlayIcon size={64} color="white" />
          )}
        </Pressable>

        {/* Next Button */}
        <Pressable
          onPress={handleNext}
          className="h-14 w-14 items-center justify-center active:opacity-70"
        >
          <NextIcon size={56} color="white" />
        </Pressable>
      </View>
    </View>
  );
}
