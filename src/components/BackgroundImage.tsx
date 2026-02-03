import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

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

  useEffect(() => {
    player.play();
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
