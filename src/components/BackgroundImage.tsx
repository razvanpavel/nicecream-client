import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet, View } from 'react-native';

import { CHANNEL_BACKGROUNDS } from '@/config/backgrounds';
import type { ChannelId } from '@/store/appStore';

interface BackgroundImageProps {
  channel: ChannelId;
}

export function BackgroundImage({ channel }: BackgroundImageProps): React.ReactElement {
  const player = useVideoPlayer(CHANNEL_BACKGROUNDS[channel], (player) => {
    player.loop = true;
    player.muted = true;
  });

  const wasPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    player.play();

    if (Platform.OS === 'web') {
      // Web: use document visibility API
      const handleVisibilityChange = (): void => {
        if (document.hidden) {
          wasPlayingRef.current = player.playing;
          player.pause();
        } else {
          if (wasPlayingRef.current) {
            player.play();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return (): void => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // Native: use AppState
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        wasPlayingRef.current = player.playing;
        player.pause();
      } else if (nextAppState === 'active') {
        if (wasPlayingRef.current) {
          player.play();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return (): void => {
      subscription.remove();
    };
  }, [player]);

  return (
    <View style={styles.container} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
