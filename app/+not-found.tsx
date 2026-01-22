import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui';

export default function NotFoundScreen(): JSX.Element {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-white p-5">
        <Text variant="heading" size="2xl">
          This screen doesn&apos;t exist.
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-blue-500">Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
