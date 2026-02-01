import Svg, { Ellipse } from 'react-native-svg';

interface CloseIconProps {
  size?: number;
  color?: string;
}

export function CloseIcon({ size = 60, color = 'white' }: CloseIconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Ellipse
        cx="30.1846"
        cy="30.1907"
        rx="11"
        ry="2"
        transform="rotate(-45 30.1846 30.1907)"
        fill={color}
      />
      <Ellipse
        cx="11"
        cy="2"
        rx="11"
        ry="2"
        transform="matrix(-0.707107 -0.707107 -0.707107 0.707107 39.375 36.5547)"
        fill={color}
      />
    </Svg>
  );
}
