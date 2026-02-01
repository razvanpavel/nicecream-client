import Svg, { Path } from 'react-native-svg';

interface PauseIconProps {
  size?: number;
  color?: string;
}

export function PauseIcon({ size = 60, color = 'white' }: PauseIconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Path
        d="M50 29.4995C50 40.82 40.8214 50 29.5 50C18.1778 50 9 40.82 9 29.4995C9 18.176 18.1779 9 29.5 9C40.8223 9 50 18.1761 50 29.4995ZM47.6388 29.4995C47.6388 19.4804 39.5169 11.3609 29.4996 11.3609C19.4818 11.3609 11.3614 19.4803 11.3614 29.4995C11.3614 39.5137 19.4819 47.6381 29.4996 47.6381C39.5165 47.6381 47.6388 39.5137 47.6388 29.4995Z"
        fill={color}
      />
      <Path
        d="M27 24H26C25.4477 24 25 24.4477 25 25V34C25 34.5523 25.4477 35 26 35H27C27.5523 35 28 34.5523 28 34V25C28 24.4477 27.5523 24 27 24Z"
        fill={color}
      />
      <Path
        d="M32 24H31C30.4477 24 30 24.4477 30 25V34C30 34.5523 30.4477 35 31 35H32C32.5523 35 33 34.5523 33 34V25C33 24.4477 32.5523 24 32 24Z"
        fill={color}
      />
    </Svg>
  );
}
