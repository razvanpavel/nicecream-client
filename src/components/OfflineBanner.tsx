import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/appStore';

import { WifiOffIcon } from './icons';
import { Text } from './ui';

export function OfflineBanner(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const isOffline = useAppStore((state) => state.isOffline);

  if (!isOffline) {
    return null;
  }

  return (
    <View className="absolute left-4" style={{ top: insets.top + 16 }} pointerEvents="none">
      <View className="flex-row items-center rounded-full bg-white/20 px-3 py-1">
        <WifiOffIcon size={12} color="#EF4444" />
        <Text size="xs" className="ml-1.5 font-heading uppercase text-red-400">
          offline
        </Text>
      </View>
    </View>
  );
}
