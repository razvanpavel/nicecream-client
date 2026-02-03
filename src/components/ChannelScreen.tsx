import { Image } from 'expo-image';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHANNEL_LOGOS } from '@/config/logos';
import type { StreamConfig } from '@/config/streams';
import { type ChannelId } from '@/store/appStore';

import { BackgroundImage } from './BackgroundImage';

interface ChannelScreenProps {
  stream: StreamConfig;
}

export function ChannelScreen({ stream }: ChannelScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const channelId = stream.id as ChannelId;

  return (
    <View className="flex-1" style={{ backgroundColor: stream.color }}>
      {/* Background Image Layer */}
      <BackgroundImage channel={channelId} />

      {/* Subtle overlay for text legibility */}
      <View className="absolute inset-0 bg-black/5" pointerEvents="none" />

      {/* Content Layer */}
      <View
        className="flex-1 items-center justify-center"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 100, // Extra space for bottom navigation
        }}
      >
        {/* Stream Logo - only on web (native has fixed logo overlay in SwipePager) */}
        {Platform.OS === 'web' && (
          <Image
            source={CHANNEL_LOGOS[channelId]}
            style={{ width: 320, height: 320 }}
            contentFit="contain"
          />
        )}

        {/* Station Name - Large heading, lowercase */}
        {/* <Text className="text-center font-heading text-10xl lowercase text-white md:text-12xl lg:text-16xl">
          {stream.name}
        </Text> */}
      </View>
    </View>
  );
}
