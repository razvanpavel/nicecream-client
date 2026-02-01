import type { ImageSource } from 'expo-image';

import type { ChannelId } from '@/store/appStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const redBackground = require('../../assets/images/backgrounds/red.gif') as ImageSource;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const greenBackground = require('../../assets/images/backgrounds/green.gif') as ImageSource;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const blueBackground = require('../../assets/images/backgrounds/blue.gif') as ImageSource;

export const CHANNEL_BACKGROUNDS: Record<ChannelId, ImageSource> = {
  red: redBackground,
  green: greenBackground,
  blue: blueBackground,
};
