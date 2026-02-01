import { useEffect, useCallback } from 'react';
import { Modal, Pressable, View } from 'react-native';

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
  // Handle escape key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return (): void => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [visible, handleKeyDown]);

  const handleOptionPress = (option: ActionSheetProps['options'][number]): void => {
    option.onPress();
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable
        className="absolute inset-0 items-center justify-end bg-black/60"
        onPress={onClose}
      >
        {/* Sheet container - stop propagation so clicking sheet doesn't close */}
        <Pressable
          className="w-full max-w-md"
          onPress={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Sheet */}
          <View className="mx-4 mb-4 overflow-hidden rounded-2xl bg-neutral-900">
            {/* Title */}
            {title !== undefined && title !== '' && (
              <View className="border-b border-neutral-800 px-4 py-3">
                <Text className="text-center text-sm uppercase text-neutral-400">{title}</Text>
              </View>
            )}

            {/* Options */}
            <View>
              {options.map((option, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    handleOptionPress(option);
                  }}
                  className={cn(
                    'border-b border-neutral-800 px-4 py-4',
                    'cursor-pointer hover:bg-neutral-800 active:bg-neutral-700',
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
          </View>

          {/* Cancel button */}
          <View className="mx-4 mb-4">
            <Pressable
              onPress={onClose}
              className="cursor-pointer rounded-2xl bg-neutral-800 py-4 hover:bg-neutral-700 active:bg-neutral-600"
            >
              <Text className="text-center text-lg font-medium text-white">{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
