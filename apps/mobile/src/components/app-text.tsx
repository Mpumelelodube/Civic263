import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { tabletTypography, typography, useTheme } from '@/theme';
import { MEDIUM_MIN_WIDTH } from '@/layout';

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  const theme = useTheme();
  const tablet = useWindowDimensions().width >= MEDIUM_MIN_WIDTH;
  const ramp =
    tablet && variant in tabletTypography
      ? tabletTypography[variant as keyof typeof tabletTypography]
      : typography[variant];
  return <Text {...props} style={[ramp, { color: theme.text }, style]} />;
}
