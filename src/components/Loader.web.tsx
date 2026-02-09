import Lottie from 'lottie-react';

import loaderAnimation from '@/assets/animations/loader.json';

interface LoaderProps {
  size?: number;
}

export function Loader({ size = 64 }: LoaderProps): React.ReactElement {
  return (
    <Lottie animationData={loaderAnimation} loop autoplay style={{ width: size, height: size }} />
  );
}
