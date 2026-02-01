import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CHANNEL_BACKGROUNDS } from '@/config/backgrounds';
import type { ChannelId } from '@/store/appStore';

interface BackgroundImageProps {
  channel: ChannelId;
}

export function BackgroundImage({ channel }: BackgroundImageProps): React.ReactElement {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={CHANNEL_BACKGROUNDS[channel]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </View>
  );
}
