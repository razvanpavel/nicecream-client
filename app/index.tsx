import { Redirect } from 'expo-router';
import Head from 'expo-router/head';
import { Platform } from 'react-native';

import { SwipePager } from '@/components/SwipePager';
import { getDefaultStreamIndex, STREAMS } from '@/config/streams';

export default function PlayerScreen(): React.ReactElement {
  // On web, redirect to the time-based default channel for proper URLs
  if (Platform.OS === 'web') {
    const defaultIndex = getDefaultStreamIndex();
    const defaultChannel = STREAMS[defaultIndex]?.id ?? 'green';
    return <Redirect href={`/${defaultChannel}`} />;
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
