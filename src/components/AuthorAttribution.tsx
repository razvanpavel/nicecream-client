import { Linking, Pressable, View } from 'react-native';

import { useAppStore, type ChannelId } from '@/store/appStore';

import { Text } from './ui';

interface AuthorAttributionProps {
  channel: ChannelId;
}

export function AuthorAttribution({ channel }: AuthorAttributionProps): React.ReactElement | null {
  const backgroundImage = useAppStore((state) => state.channelBackgrounds[channel]);

  if (backgroundImage?.author == null || backgroundImage.author === '') {
    return null;
  }

  const handlePress = (): void => {
    if (backgroundImage.authorUrl !== '') {
      void Linking.openURL(backgroundImage.authorUrl);
    }
  };

  const hasLink = backgroundImage.authorUrl !== '';

  const content = (
    <View className="rounded-full bg-black/20 px-3 py-1">
      <Text className="text-xs text-white/60">photo by {backgroundImage.author.toLowerCase()}</Text>
    </View>
  );

  if (hasLink) {
    return (
      <Pressable onPress={handlePress} className="active:opacity-70">
        {content}
      </Pressable>
    );
  }

  return content;
}
