import Svg, { Path } from 'react-native-svg';

interface PlayIconProps {
  size?: number;
  color?: string;
}

export function PlayIcon({ size = 60, color = 'white' }: PlayIconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Path
        d="M50 29.4995C50 40.82 40.8214 50 29.5 50C18.1778 50 9 40.82 9 29.4995C9 18.176 18.1779 9 29.5 9C40.8223 9 50 18.1761 50 29.4995ZM47.6388 29.4995C47.6388 19.4804 39.5169 11.3609 29.4996 11.3609C19.4818 11.3609 11.3614 19.4803 11.3614 29.4995C11.3614 39.5137 19.4819 47.6381 29.4996 47.6381C39.5165 47.6381 47.6388 39.5137 47.6388 29.4995Z"
        fill={color}
      />
      <Path
        d="M36.5 30.366C37.1667 29.9811 37.1667 29.0189 36.5 28.634L26.75 23.0048C26.0833 22.6199 25.25 23.101 25.25 23.8708V35.1292C25.25 35.899 26.0833 36.3801 26.75 35.9952L36.5 30.366Z"
        fill={color}
      />
    </Svg>
  );
}
