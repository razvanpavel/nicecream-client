import LottieView from 'lottie-react-native';

import loaderAnimation from '@/assets/animations/loader.json';

interface LoaderProps {
  size?: number;
}

export function Loader({ size = 64 }: LoaderProps): React.ReactElement {
  return (
    <LottieView
      source={loaderAnimation}
      autoPlay
      loop
      style={{ width: size, height: size }}
    />
  );
}
