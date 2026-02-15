import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { SwipePager } from '@/components/SwipePager';
import { getDefaultStreamIndex, STREAMS } from '@/config/streams';

export default function PlayerScreen(): React.ReactElement {
  const router = useRouter();

  // On web, redirect to the time-based default channel.
  // Done in useEffect to avoid hydration mismatch (build time ≠ client time).
  useEffect(() => {
    if (Platform.OS === 'web') {
      const defaultIndex = getDefaultStreamIndex();
      const defaultChannel = STREAMS[defaultIndex]?.id ?? 'green';
      router.replace(`/${defaultChannel}`);
    }
  }, [router]);

  if (Platform.OS === 'web') {
    // Render nothing during SSG/hydration — HomeOverlay covers the screen
    return <></>;
  }

  // On native, use the swipe pager (URLs don't matter)
  return (
    <>
      <Head>
        <title>nicecream.fm</title>
      </Head>
      <SwipePager />
    </>
  );
}
