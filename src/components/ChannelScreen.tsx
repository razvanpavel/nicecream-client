import { Image } from 'expo-image';
import { View } from 'react-native';

import { CHANNEL_LOGOS } from '@/config/logos';
import type { StreamConfig } from '@/config/streams';
import { type ChannelId } from '@/store/appStore';

import { BackgroundImage } from './BackgroundImage';

interface ChannelScreenProps {
  stream: StreamConfig;
  isActive?: boolean;
  showLogo?: boolean;
}

export function ChannelScreen({
  stream,
  isActive,
  showLogo = true,
}: ChannelScreenProps): React.ReactElement {
  const channelId = stream.id as ChannelId;

  return (
    <View className="flex-1 bg-[#141414]">
      {/* Background Image Layer */}
      <BackgroundImage channel={channelId} {...(isActive !== undefined && { isActive })} />

      {/* Subtle overlay for text legibility */}
      <View className="absolute inset-0 bg-black/5" pointerEvents="none" />

      {/* Stream Logo - centered on screen */}
      {showLogo && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Image
            source={CHANNEL_LOGOS[channelId]}
            style={{ width: 268, height: 268 }}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
}
