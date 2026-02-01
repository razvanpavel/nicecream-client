import type { ImageSource } from 'expo-image';

import type { ChannelId } from '@/store/appStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const redLogo = require('../../assets/images/logos/red.png') as ImageSource;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const greenLogo = require('../../assets/images/logos/green.png') as ImageSource;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const blueLogo = require('../../assets/images/logos/blue.png') as ImageSource;

export const CHANNEL_LOGOS: Record<ChannelId, ImageSource> = {
  red: redLogo,
  green: greenLogo,
  blue: blueLogo,
};
