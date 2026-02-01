import Svg, { Ellipse } from 'react-native-svg';

interface MenuIconProps {
  size?: number;
  color?: string;
}

export function MenuIcon({ size = 60, color = 'white' }: MenuIconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Ellipse cx="29.5" cy="24" rx="11" ry="2" fill={color} />
      <Ellipse cx="29.5" cy="30" rx="11" ry="2" fill={color} />
      <Ellipse cx="29.5" cy="36" rx="11" ry="2" fill={color} />
    </Svg>
  );
}
