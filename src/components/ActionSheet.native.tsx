import { useEffect, useRef } from 'react';
// eslint-disable-next-line react-native/split-platform-components
import { ActionSheetIOS, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/utils/cn';

import type { ActionSheetProps } from './ActionSheet';
import { Text } from './ui';

export function ActionSheet({
  visible,
  onClose,
  title,
  options,
  cancelLabel = 'cancel',
}: ActionSheetProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  // Track if we've already shown the iOS action sheet for this visible=true state
  const hasShownRef = useRef(false);

  // iOS: Show native action sheet when visible becomes true
  useEffect(() => {
    if (Platform.OS === 'ios' && visible && !hasShownRef.current) {
      hasShownRef.current = true;

      const optionLabels = options.map((opt) => opt.label);
      const cancelButtonIndex = options.length;
      const destructiveIndices = options
        .map((opt, index) => (opt.destructive === true ? index : -1))
        .filter((index) => index !== -1);

      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...optionLabels, cancelLabel],
          cancelButtonIndex,
          destructiveButtonIndex: destructiveIndices.length > 0 ? destructiveIndices[0] : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex === cancelButtonIndex) {
            onClose();
          } else {
            const selectedOption = options[buttonIndex];
            if (selectedOption !== undefined) {
              selectedOption.onPress();
            }
            onClose();
          }
        }
      );
    }

    // Reset when visible becomes false
    if (!visible) {
      hasShownRef.current = false;
    }
  }, [visible, options, title, cancelLabel, onClose]);

  // iOS: Return null as we use native UI
  if (Platform.OS === 'ios') {
    return null;
  }

  // Android: Custom modal implementation
  const handleOptionPress = (option: ActionSheetProps['options'][number]): void => {
    option.onPress();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1" />
      </Pressable>

      {/* Sheet */}
      <View className="rounded-t-2xl bg-neutral-900" style={{ paddingBottom: insets.bottom + 16 }}>
        {/* Title */}
        {title !== undefined && title !== '' && (
          <View className="border-b border-neutral-800 px-4 py-3">
            <Text className="text-center text-sm uppercase text-neutral-400">{title}</Text>
          </View>
        )}

        {/* Options */}
        <View className="px-4 pt-2">
          {options.map((option, index) => (
            <Pressable
              key={index}
              onPress={() => {
                handleOptionPress(option);
              }}
              className={cn(
                'border-b border-neutral-800 py-4 active:bg-neutral-800',
                index === options.length - 1 && 'border-b-0'
              )}
            >
              <Text
                className={cn(
                  'text-center text-lg',
                  option.destructive === true ? 'text-red-500' : 'text-white'
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Cancel */}
        <View className="mx-4 mt-2">
          <Pressable
            onPress={onClose}
            className="rounded-xl bg-neutral-800 py-4 active:bg-neutral-700"
          >
            <Text className="text-center text-lg text-white">{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
