import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { BottomNavigation } from '@/components/BottomNavigation';
import { ChannelScreen } from '@/components/ChannelScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { STREAMS } from '@/config/streams';
import { useAppStore } from '@/store/appStore';
import { useAudioStore } from '@/store/audioStore';

type ChannelId = 'red' | 'green' | 'blue';

const VALID_CHANNELS: ChannelId[] = ['red', 'green', 'blue'];

const SWIPE_THRESHOLD = 50; // Minimum distance to trigger swipe

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
  const router = useRouter();
  const { status, currentStreamUrl, playStream, togglePlayback } = useAudioStore();
  const setCurrentStreamIndex = useAppStore((state) => state.setCurrentStreamIndex);

  // Touch swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Validate channel parameter
  const currentChannel: ChannelId = isChannelId(channel) ? channel : 'green';
  const stream = STREAMS.find((s) => s.id === currentChannel);

  const { prev, next } = getAdjacentChannels(currentChannel);

  const handlePrevious = useCallback((): void => {
    router.replace(`/${prev}`);
  }, [router, prev]);

  const handleNext = useCallback((): void => {
    router.replace(`/${next}`);
  }, [router, next]);

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

  // Keyboard and touch handlers (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || stream === undefined) return undefined;

    // Spacebar to play/pause
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();

        if (currentStreamUrl === stream.url) {
          void togglePlayback();
        } else {
          void playStream(stream.url, stream.name);
        }
      }
    };

    // Touch swipe handling
    const handleTouchStart = (e: TouchEvent): void => {
      const touch = e.touches[0];
      if (touch !== undefined) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent): void => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touch = e.changedTouches[0];
      if (touch === undefined) return;

      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // Only trigger if horizontal swipe is more significant than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX > 0) {
          // Swipe right → go to previous
          handlePrevious();
        } else {
          // Swipe left → go to next
          handleNext();
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [stream, currentStreamUrl, status, togglePlayback, playStream, handlePrevious, handleNext]);

  // Redirect if invalid channel
  if (!isChannelId(channel)) {
    return <Redirect href="/green" />;
  }

  if (stream === undefined) {
    return <Redirect href="/green" />;
  }

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

        {/* Offline Banner */}
        <OfflineBanner />

        {/* Fixed Bottom Navigation */}
        <BottomNavigation onPrevious={handlePrevious} onNext={handleNext} />
      </View>
    </>
  );
}
