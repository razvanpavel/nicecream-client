import type { VideoSource } from 'expo-video';

import type { ChannelId } from '@/store/appStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const redBackground = require('../../assets/images/backgrounds/red.mp4') as VideoSource;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const greenBackground = require('../../assets/images/backgrounds/green.mp4') as VideoSource;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const blueBackground = require('../../assets/images/backgrounds/blue.mp4') as VideoSource;

export const CHANNEL_BACKGROUNDS: Record<ChannelId, VideoSource> = {
  red: redBackground,
  green: greenBackground,
  blue: blueBackground,
};
