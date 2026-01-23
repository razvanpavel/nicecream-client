import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { ChannelScreen } from '@/components/ChannelScreen';
import { Text } from '@/components/ui';
import { STREAMS } from '@/config/streams';
import { useAudioStore } from '@/store/audioStore';

type ChannelId = 'red' | 'green' | 'blue';

const VALID_CHANNELS: ChannelId[] = ['red', 'green', 'blue'];

// Pre-render these routes during static export
export function generateStaticParams(): { channel: ChannelId }[] {
  return VALID_CHANNELS.map((channel) => ({ channel }));
}

function getAdjacentChannels(currentId: ChannelId): { prev: ChannelId; next: ChannelId } {
  const currentIndex = VALID_CHANNELS.indexOf(currentId);
  const prevIndex = currentIndex === 0 ? VALID_CHANNELS.length - 1 : currentIndex - 1;
  const nextIndex = currentIndex === VALID_CHANNELS.length - 1 ? 0 : currentIndex + 1;
  return {
    prev: VALID_CHANNELS[prevIndex] as ChannelId,
    next: VALID_CHANNELS[nextIndex] as ChannelId,
  };
}

export default function ChannelRoute(): React.ReactElement {
  const { channel } = useLocalSearchParams<{ channel: string }>();

  // Validate channel parameter
  if (!channel || !VALID_CHANNELS.includes(channel as ChannelId)) {
    return <Redirect href="/green" />;
  }

  const currentChannel = channel as ChannelId;
  const stream = STREAMS.find((s) => s.id === currentChannel);
  const { status, currentStreamUrl, playStream, togglePlayback } = useAudioStore();

  // Spacebar to play/pause (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !stream) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();

        // If this stream is active, toggle playback
        if (currentStreamUrl === stream.url) {
          void togglePlayback();
        } else {
          // Otherwise, start playing this stream
          void playStream(stream.url, stream.name);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stream, currentStreamUrl, status, togglePlayback, playStream]);

  if (!stream) {
    return <Redirect href="/green" />;
  }

  const { prev, next } = getAdjacentChannels(currentChannel);
  const prevStream = STREAMS.find((s) => s.id === prev);
  const nextStream = STREAMS.find((s) => s.id === next);

  return (
    <>
      <Head>
        <title>{stream.name.toLowerCase()} - nicecream.fm</title>
        <meta
          name="description"
          content={`listen to ${stream.name.toLowerCase()} channel on nicecream.fm`}
        />
      </Head>
      <View className="relative flex-1">
        <ChannelScreen stream={stream} />

        {/* Navigation Arrows - colored by destination stream */}
        <Link href={`/${prev}`} asChild replace>
          <Pressable
            className="absolute left-4 top-1/2 h-12 w-12 -translate-y-6 items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: prevStream?.color }}
          >
            <Text className="text-xl text-white">←</Text>
          </Pressable>
        </Link>

        <Link href={`/${next}`} asChild replace>
          <Pressable
            className="absolute right-4 top-1/2 h-12 w-12 -translate-y-6 items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: nextStream?.color }}
          >
            <Text className="text-xl text-white">→</Text>
          </Pressable>
        </Link>

        {/* Dots Indicator - colored by stream */}
        <View className="absolute bottom-10 left-0 right-0 flex-row justify-center gap-2">
          {STREAMS.map((s) => (
            <Link key={s.id} href={`/${s.id}`} asChild replace>
              <Pressable>
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: s.id === currentChannel ? 'white' : s.color,
                    opacity: s.id === currentChannel ? 1 : 0.6,
                  }}
                />
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </>
  );
}
