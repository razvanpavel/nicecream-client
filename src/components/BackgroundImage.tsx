import { Image } from 'expo-image';
import { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useAppStore, type ChannelId } from '@/store/appStore';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const CROSSFADE_DURATION = 400; // ms

interface SlotState {
  slotAUrl: string | null;
  slotBUrl: string | null;
  activeSlot: 'A' | 'B';
}

interface SetUrlAction {
  type: 'SET_URL';
  url: string;
}

function slotReducer(state: SlotState, action: SetUrlAction): SlotState {
  // Load into inactive slot and switch
  if (state.activeSlot === 'A') {
    return {
      ...state,
      slotBUrl: action.url,
      activeSlot: 'B',
    };
  } else {
    return {
      ...state,
      slotAUrl: action.url,
      activeSlot: 'A',
    };
  }
}

interface BackgroundImageProps {
  channel: ChannelId;
}

export function BackgroundImage({ channel }: BackgroundImageProps): React.ReactElement {
  const backgroundImage = useAppStore((state) => state.channelBackgrounds[channel]);

  const [slotState, dispatch] = useReducer(slotReducer, {
    slotAUrl: null,
    slotBUrl: null,
    activeSlot: 'A',
  });

  // Track previous URL to detect changes
  const prevUrlRef = useRef<string | null>(null);

  // Animated opacity values
  const opacityA = useSharedValue(0);
  const opacityB = useSharedValue(0);

  // Handle URL changes
  const currentUrl = backgroundImage?.url ?? null;

  useEffect(() => {
    if (currentUrl === null) return;
    if (currentUrl === prevUrlRef.current) return;

    prevUrlRef.current = currentUrl;
    dispatch({ type: 'SET_URL', url: currentUrl });
  }, [currentUrl]);

  // Animate based on active slot changes
  useEffect(() => {
    if (slotState.activeSlot === 'A' && slotState.slotAUrl !== null) {
      opacityA.value = withTiming(1, {
        duration: CROSSFADE_DURATION,
        easing: Easing.inOut(Easing.ease),
      });
      opacityB.value = withTiming(0, {
        duration: CROSSFADE_DURATION,
        easing: Easing.inOut(Easing.ease),
      });
    } else if (slotState.activeSlot === 'B' && slotState.slotBUrl !== null) {
      opacityB.value = withTiming(1, {
        duration: CROSSFADE_DURATION,
        easing: Easing.inOut(Easing.ease),
      });
      opacityA.value = withTiming(0, {
        duration: CROSSFADE_DURATION,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [slotState.activeSlot, slotState.slotAUrl, slotState.slotBUrl, opacityA, opacityB]);

  const animatedStyleA = useAnimatedStyle(() => ({
    opacity: opacityA.value,
  }));

  const animatedStyleB = useAnimatedStyle(() => ({
    opacity: opacityB.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Slot A */}
      {slotState.slotAUrl != null && (
        <AnimatedImage
          source={{ uri: slotState.slotAUrl }}
          style={[StyleSheet.absoluteFill, animatedStyleA]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}

      {/* Slot B */}
      {slotState.slotBUrl != null && (
        <AnimatedImage
          source={{ uri: slotState.slotBUrl }}
          style={[StyleSheet.absoluteFill, animatedStyleB]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}
    </View>
  );
}
