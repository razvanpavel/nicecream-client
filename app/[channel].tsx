import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { ChannelScreen } from '@/components/ChannelScreen';
import { Text } from '@/components/ui';
import { STREAMS } from '@/config/streams';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';
import { cn } from '@/utils/cn';

type ChannelId = 'red' | 'green' | 'blue';

const VALID_CHANNELS: ChannelId[] = ['red', 'green', 'blue'];

const DOT_COLORS: Record<ChannelId, string> = {
  red: 'bg-brand-red',
  green: 'bg-brand-green',
  blue: 'bg-brand-blue',
};

function isChannelId(value: string): value is ChannelId {
  return (VALID_CHANNELS as string[]).includes(value);
}

// Pre-render these routes during static export
export function generateStaticParams(): { channel: ChannelId }[] {
  return VALID_CHANNELS.map((channel) => ({ channel }));
}

function getAdjacentChannels(currentId: ChannelId): { prev: ChannelId; next: ChannelId } {
  const currentIndex = VALID_CHANNELS.indexOf(currentId);
  const prevIndex = currentIndex === 0 ? VALID_CHANNELS.length - 1 : currentIndex - 1;
  const nextIndex = currentIndex === VALID_CHANNELS.length - 1 ? 0 : currentIndex + 1;
  // Safe access - indices are always valid based on VALID_CHANNELS.length
  const prev = VALID_CHANNELS[prevIndex] ?? 'red';
  const next = VALID_CHANNELS[nextIndex] ?? 'red';
  return { prev, next };
}

export default function ChannelRoute(): React.ReactElement {
  const { channel } = useLocalSearchParams<{ channel: string }>();
  const { status, currentStreamUrl, playStream, togglePlayback } = useAudioStore();
  const setCurrentStreamIndex = useAppStore((state) => state.setCurrentStreamIndex);

  // Validate channel parameter
  const currentChannel: ChannelId = isChannelId(channel) ? channel : 'green';
  const stream = STREAMS.find((s) => s.id === currentChannel);

  // Sync stream index for background image hook
  useEffect(() => {
    const index = VALID_CHANNELS.indexOf(currentChannel);
    if (index !== -1) {
      setCurrentStreamIndex(index);
    }
  }, [currentChannel, setCurrentStreamIndex]);

  // When channel changes, switch stream if already playing
  useEffect(() => {
    if (stream === undefined) return;

    // Get fresh status from store to avoid stale closure
    const currentStatus = useAudioStore.getState().status;
    const currentUrl = useAudioStore.getState().currentStreamUrl;

    // If music is playing/loading a different stream, switch to this one
    if ((currentStatus === 'playing' || currentStatus === 'loading') && currentUrl !== stream.url) {
      void playStream(stream.url, stream.name);
    }
  }, [currentChannel, stream, playStream]);

  // Spacebar to play/pause (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || stream === undefined) return undefined;

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
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stream, currentStreamUrl, status, togglePlayback, playStream]);

  // Redirect if invalid channel
  if (!isChannelId(channel)) {
    return <Redirect href="/green" />;
  }

  if (stream === undefined) {
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
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    s.id === currentChannel ? 'bg-white' : [DOT_COLORS[s.id], 'opacity-60']
                  )}
                />
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </>
  );
}
