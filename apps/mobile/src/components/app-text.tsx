import { Text, type TextProps } from 'react-native';
import { typography, useTheme } from '@/theme';

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  const theme = useTheme();
  return <Text {...props} style={[typography[variant], { color: theme.text }, style]} />;
}
