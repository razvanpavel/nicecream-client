import { useState, useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STREAMS } from '@/config/streams';
import { useHaptics } from '@/hooks/useHaptics';
import { isExpoGo } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';
import { cn } from '@/utils/cn';
import { openMusicSearch, type MusicService } from '@/utils/musicSearch';

import { ActionSheet, type ActionSheetOption } from './ActionSheet';
import { CloseIcon, HeartIcon, MenuIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';
import { Loader } from './Loader';
import { Text } from './ui';

export function BottomNavigation(): React.ReactElement {
  const navigateChannel = useAppStore((s) => s.navigateChannel);
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const status = useAudioStore((s) => s.status);
  const currentStreamUrl = useAudioStore((s) => s.currentStreamUrl);
  const streamMetadata = useAudioStore((s) => s.streamMetadata);
  const togglePlayback = useAudioStore((s) => s.togglePlayback);
  const playStream = useAudioStore((s) => s.playStream);
  const isPlayerSetup = useAppStore((state) => state.isPlayerSetup);
  const currentStreamIndex = useAppStore((state) => state.currentStreamIndex);
  const isOffline = useAppStore((state) => state.isOffline);
  const isHomeVisible = useAppStore((s) => s.isHomeVisible);
  const hasHomeDismissed = useAppStore((s) => s.hasHomeDismissed);
  const isHomeFullyHidden = useAppStore((s) => s.isHomeFullyHidden);

  // Controls appear only after the home overlay dismiss animation completes
  const hideNav = !isHomeFullyHidden;
  const showMenuButton = hasHomeDismissed;

  const [showFavoriteSheet, setShowFavoriteSheet] = useState(false);

  // Find the current stream based on index
  const currentStream = STREAMS[currentStreamIndex];

  const isCurrentStreamActive =
    currentStreamUrl !== null && currentStream !== undefined
      ? currentStreamUrl === currentStream.url
      : false;
  const isPlaying = status === 'playing' && isCurrentStreamActive;
  const isLoading =
    (status === 'loading' && isCurrentStreamActive) || (!isPlayerSetup && !isExpoGo);

  // Check if we have valid track metadata to search
  // Also disable during loading/transitioning states
  const hasTrackInfo =
    status === 'playing' &&
    !isLoading &&
    streamMetadata !== null &&
    ((streamMetadata.title != null &&
      streamMetadata.title !== '-' &&
      streamMetadata.title !== '') ||
      (streamMetadata.artist != null &&
        streamMetadata.artist !== '-' &&
        streamMetadata.artist !== ''));

  const handlePlayPause = (): void => {
    if (currentStream === undefined) return;
    void haptics.medium();

    if (isCurrentStreamActive) {
      void togglePlayback();
    } else {
      void playStream(currentStream.url, currentStream.name);
    }
  };

  const handlePrevious = (): void => {
    void haptics.light();
    navigateChannel('prev');
  };

  const handleNext = (): void => {
    void haptics.light();
    navigateChannel('next');
  };

  const handleHeartPress = (): void => {
    if (hasTrackInfo) {
      void haptics.light();
      setShowFavoriteSheet(true);
    }
  };

  const setHomeVisible = useAppStore((state) => state.setHomeVisible);

  const handleMenuPress = (): void => {
    void haptics.light();
    setHomeVisible(!isHomeVisible);
  };

  const handleMusicSearch = useCallback(
    (service: MusicService): void => {
      if (streamMetadata === null) return;

      const artist = streamMetadata.artist ?? '';
      const title = streamMetadata.title ?? '';

      void openMusicSearch(service, artist, title);
    },
    [streamMetadata]
  );

  const favoriteOptions: ActionSheetOption[] = [
    {
      label: 'SoundCloud',
      onPress: (): void => {
        handleMusicSearch('soundcloud');
      },
    },
    {
      label: 'Apple Music',
      onPress: (): void => {
        handleMusicSearch('apple');
      },
    },
    {
      label: 'YouTube Music',
      onPress: (): void => {
        handleMusicSearch('youtube');
      },
    },
    {
      label: 'Spotify',
      onPress: (): void => {
        handleMusicSearch('spotify');
      },
    },
  ];

  // Show track info only when playing and metadata has displayable content
  const showTrackInfo = isPlaying && hasTrackInfo;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 items-center justify-center"
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ paddingBottom: insets.bottom + 16, zIndex: 2 }}
      pointerEvents="box-none"
    >
      {/* Track Info or Stream Name (invisible on home to preserve layout) */}
      <View
        className={cn('mb-8 items-center px-8', hideNav && 'opacity-0')}
        pointerEvents={hideNav ? 'none' : 'auto'}
      >
        {showTrackInfo ? (
          <>
            {streamMetadata.title != null && streamMetadata.title !== '-' && (
              <Text
                className="text-center font-heading text-lg font-bold uppercase tracking-wider text-white"
                numberOfLines={1}
              >
                {streamMetadata.title}
              </Text>
            )}
            {streamMetadata.artist != null && streamMetadata.artist !== '-' && (
              <Text
                className="text-center text-base uppercase tracking-wider text-white"
                numberOfLines={1}
              >
                {streamMetadata.artist}
              </Text>
            )}
          </>
        ) : (
          <Text className="text-center font-heading text-2xl font-bold lowercase text-white">
            {currentStream?.name ?? ''}
          </Text>
        )}
      </View>

      {/* Playback Controls */}
      <View className="flex-row items-center justify-center gap-6">
        {/* Heart/Favorite Button */}
        <Pressable
          onPress={handleHeartPress}
          disabled={!hasTrackInfo || hideNav}
          className={cn(
            'h-16 w-16 items-center justify-center active:opacity-70',
            hideNav ? 'opacity-0' : !hasTrackInfo ? 'opacity-40' : ''
          )}
        >
          <HeartIcon size={56} color="white" />
        </Pressable>

        {/* Previous Button */}
        <Pressable
          onPress={handlePrevious}
          disabled={hideNav}
          className={cn(
            'h-16 w-16 items-center justify-center active:opacity-70',
            hideNav && 'opacity-0'
          )}
        >
          <PrevIcon size={56} color="white" />
        </Pressable>

        {/* Play/Pause Button */}
        <Pressable
          onPress={handlePlayPause}
          disabled={isLoading || isOffline || hideNav}
          className={cn(
            'h-16 w-16 items-center justify-center active:opacity-70',
            hideNav ? 'opacity-0' : isOffline ? 'opacity-40' : ''
          )}
        >
          {isLoading ? (
            <Loader size={100} />
          ) : isPlaying ? (
            <PauseIcon size={64} color="white" />
          ) : (
            <PlayIcon size={64} color="white" />
          )}
        </Pressable>

        {/* Next Button */}
        <Pressable
          onPress={handleNext}
          disabled={hideNav}
          className={cn(
            'h-16 w-16 items-center justify-center active:opacity-70',
            hideNav && 'opacity-0'
          )}
        >
          <NextIcon size={56} color="white" />
        </Pressable>

        {/* Menu / Close Toggle — hidden on initial home visit */}
        <Pressable
          onPress={handleMenuPress}
          disabled={!showMenuButton}
          className={cn(
            'h-16 w-16 items-center justify-center active:opacity-70',
            !showMenuButton && 'opacity-0'
          )}
        >
          {isHomeVisible ? (
            <CloseIcon size={38} color="white" />
          ) : (
            <MenuIcon size={56} color="white" />
          )}
        </Pressable>
      </View>

      {/* Favorite Action Sheet */}
      <ActionSheet
        visible={showFavoriteSheet}
        onClose={(): void => {
          setShowFavoriteSheet(false);
        }}
        title="Find this track"
        options={favoriteOptions}
        cancelLabel="Cancel"
      />
    </View>
  );
}
