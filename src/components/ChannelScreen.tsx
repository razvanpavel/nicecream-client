import { Image } from 'expo-image';
import { Platform, View } from 'react-native';

import { CHANNEL_LOGOS } from '@/config/logos';
import type { StreamConfig } from '@/config/streams';
import { type ChannelId } from '@/store/appStore';

import { BackgroundImage } from './BackgroundImage';

interface ChannelScreenProps {
  stream: StreamConfig;
}

export function ChannelScreen({ stream }: ChannelScreenProps): React.ReactElement {
  const channelId = stream.id as ChannelId;

  return (
    <View className="flex-1" style={{ backgroundColor: stream.color }}>
      {/* Background Image Layer */}
      <BackgroundImage channel={channelId} />

      {/* Subtle overlay for text legibility */}
      <View className="absolute inset-0 bg-black/5" pointerEvents="none" />

      {/* Stream Logo - true screen center (web only, native uses SwipePager overlay) */}
      {Platform.OS === 'web' && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Image
            source={CHANNEL_LOGOS[channelId]}
            className="aspect-square w-4/5 max-w-80"
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
}
