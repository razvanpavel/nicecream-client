import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet, View } from 'react-native';

import { CHANNEL_BACKGROUNDS } from '@/config/backgrounds';
import type { ChannelId } from '@/store/appStore';

interface BackgroundImageProps {
  channel: ChannelId;
}

const ERROR_RECOVERY_COOLDOWN_MS = 2000;

/**
 * Ensure the video player is actively playing, reloading the source if the OS
 * reclaimed resources while the app was backgrounded (status becomes 'idle' or 'error').
 */
function ensurePlaying(player: ReturnType<typeof useVideoPlayer>, channel: ChannelId): void {
  if (player.status === 'idle' || player.status === 'error') {
    void player.replaceAsync(CHANNEL_BACKGROUNDS[channel]);
  }
  player.play();
}

export function BackgroundImage({ channel }: BackgroundImageProps): React.ReactElement {
  const player = useVideoPlayer(CHANNEL_BACKGROUNDS[channel], (player) => {
    player.loop = true;
    player.muted = true;
  });

  // Track app foreground state so videos pause when backgrounded
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Cooldown for error recovery to prevent infinite retry loops
  const lastRecoveryRef = useRef(0);

  useEffect(() => {
    player.play();

    if (Platform.OS === 'web') {
      // Web: use document visibility API
      const handleVisibilityChange = (): void => {
        if (document.hidden) {
          player.pause();
        } else {
          ensurePlaying(player, channel);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return (): void => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // Native: use AppState
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      appStateRef.current = nextAppState;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        player.pause();
      } else if (nextAppState === 'active') {
        ensurePlaying(player, channel);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return (): void => {
      subscription.remove();
    };
  }, [player, channel]);

  // Error recovery: listen for statusChange events on native
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const statusSubscription = player.addListener('statusChange', (newStatus) => {
      if (newStatus.status !== 'error') return;

      console.warn(`[BackgroundImage] ${channel} video error, attempting recovery`);

      const now = Date.now();
      if (now - lastRecoveryRef.current < ERROR_RECOVERY_COOLDOWN_MS) return;
      lastRecoveryRef.current = now;

      if (appStateRef.current === 'active') {
        ensurePlaying(player, channel);
      }
    });

    return (): void => {
      statusSubscription.remove();
    };
  }, [player, channel]);

  return (
    <View style={styles.container} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
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
