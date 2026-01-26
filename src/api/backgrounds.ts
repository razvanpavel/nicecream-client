import axios from 'axios';

const BACKGROUND_API_URL = 'https://nicecream-work.tcrhd.net/background-api.php';

export type BackgroundCategory = 'red' | 'green' | 'blue';

export interface BackgroundResponse {
  image: string;
  author: string;
  authorUrl: string;
}

/**
 * Fetch a background image for the specified channel/category
 * @param category - The channel category ('red', 'green', or 'blue')
 */
export async function fetchBackground(category: BackgroundCategory): Promise<BackgroundResponse> {
  const response = await axios.get<BackgroundResponse>(BACKGROUND_API_URL, {
    params: { category },
    timeout: 10000,
  });
  return response.data;
}

/**
 * Preload an image to ensure it's cached before displaying
 * @param imageUrl - The URL of the image to preload
 */
export function preloadImage(imageUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // For React Native, we'd use Image.prefetch
    // For web, we create a new Image object
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = (): void => {
        resolve(undefined);
      };
      img.onerror = reject;
      img.src = imageUrl;
    } else {
      // Fallback for environments without Image constructor
      resolve();
    }
  });
}

/**
 * Fetch and optionally preload a background image
 * @param category - The channel category
 * @param shouldPreload - Whether to preload the image before returning
 */
export async function fetchAndPreloadBackground(
  category: BackgroundCategory,
  shouldPreload = true
): Promise<BackgroundResponse> {
  const background = await fetchBackground(category);

  if (shouldPreload) {
    try {
      await preloadImage(background.image);
    } catch (error) {
      console.warn('Failed to preload background image:', error);
      // Continue even if preload fails
    }
  }

  return background;
}
