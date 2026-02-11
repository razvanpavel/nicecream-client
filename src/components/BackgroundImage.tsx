import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet, View } from 'react-native';

import { CHANNEL_BACKGROUNDS } from '@/config/backgrounds';
import type { ChannelId } from '@/store/appStore';

interface BackgroundImageProps {
  channel: ChannelId;
  isActive?: boolean;
}

const ERROR_RECOVERY_COOLDOWN_MS = 2000;

/**
 * Ensure the video player is actively playing, reloading the source if the OS
 * reclaimed resources while the app was backgrounded (status becomes 'idle' or 'error').
 *
 * When the player is idle/error, replaceAsync loads the source asynchronously.
 * We skip the synchronous play() call in that case — the statusChange listener
 * will call play() once the player reaches 'readyToPlay'.
 */
function ensurePlaying(player: ReturnType<typeof useVideoPlayer>, channel: ChannelId): void {
  if (player.status === 'idle' || player.status === 'error') {
    void player.replaceAsync(CHANNEL_BACKGROUNDS[channel]);
    return;
  }
  player.play();
}

export function BackgroundImage({ channel, isActive }: BackgroundImageProps): React.ReactElement {
  // Default to true so web (which never passes isActive) always plays
  const effectiveActive = isActive !== false;

  // Lazy mount: once this page has been active, keep the video player mounted forever.
  // Uses the "adjust state during render" pattern (not in an effect) to derive from props.
  const [hasBeenActive, setHasBeenActive] = useState(effectiveActive);
  if (effectiveActive && !hasBeenActive) {
    setHasBeenActive(true);
  }

  // Don't mount the video player until this page has been visited
  if (!hasBeenActive) {
    return <View style={styles.container} pointerEvents="none" />;
  }

  return <BackgroundVideo channel={channel} effectiveActive={effectiveActive} />;
}

interface BackgroundVideoProps {
  channel: ChannelId;
  effectiveActive: boolean;
}

function BackgroundVideo({ channel, effectiveActive }: BackgroundVideoProps): React.ReactElement {
  const player = useVideoPlayer(CHANNEL_BACKGROUNDS[channel], (player) => {
    player.loop = true;
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
  });

  // Track app foreground state so videos pause when backgrounded
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Cooldown for error recovery to prevent infinite retry loops
  const lastRecoveryRef = useRef(0);
  // Track isActive in a ref so event handlers see the latest value
  const isActiveRef = useRef(effectiveActive);

  useEffect(() => {
    isActiveRef.current = effectiveActive;
  }, [effectiveActive]);

  // Play/pause based on isActive changes
  useEffect(() => {
    if (effectiveActive && appStateRef.current === 'active') {
      ensurePlaying(player, channel);
    } else {
      player.pause();
    }
  }, [effectiveActive, player, channel]);

  useEffect(() => {
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
    // Only pause on 'background' — not 'inactive'. The inactive state is
    // transient (app-switcher animation, control center) and pausing there
    // races with the immediate 'active' transition, causing play() to not
    // stick on foreground resume.
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'background') {
        player.pause();
      } else if (nextAppState === 'active' && prevState === 'background' && isActiveRef.current) {
        ensurePlaying(player, channel);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return (): void => {
      subscription.remove();
    };
  }, [player, channel]);

  // Status change listener: auto-play when ready, recover from errors
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const statusSubscription = player.addListener('statusChange', (newStatus) => {
      if (!isActiveRef.current || appStateRef.current !== 'active') return;

      if (newStatus.status === 'readyToPlay') {
        player.play();
        return;
      }

      if (newStatus.status === 'error') {
        console.warn(`[BackgroundImage] ${channel} video error, attempting recovery`);

        const now = Date.now();
        if (now - lastRecoveryRef.current < ERROR_RECOVERY_COOLDOWN_MS) return;
        lastRecoveryRef.current = now;

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
