import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface HapticTriggers {
  light: () => Promise<void>;
  medium: () => Promise<void>;
  heavy: () => Promise<void>;
  success: () => Promise<void>;
  error: () => Promise<void>;
  warning: () => Promise<void>;
}

export function useHaptics(): HapticTriggers {
  const isNative = Platform.OS !== 'web';

  return {
    light: async (): Promise<void> => {
      if (!isNative) return;
      if (Platform.OS === 'ios') {
        await Haptics.selectionAsync();
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    medium: async (): Promise<void> => {
      if (!isNative) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    heavy: async (): Promise<void> => {
      if (!isNative) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    success: async (): Promise<void> => {
      if (!isNative) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    error: async (): Promise<void> => {
      if (!isNative) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    warning: async (): Promise<void> => {
      if (!isNative) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  };
}
