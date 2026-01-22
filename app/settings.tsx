import { View } from 'react-native';

import { Text } from '@/components/ui';

export default function SettingsScreen(): JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text variant="heading" size="2xl">
        Settings
      </Text>
      <Text variant="muted" className="mt-2">
        Coming soon
      </Text>
    </View>
  );
}
