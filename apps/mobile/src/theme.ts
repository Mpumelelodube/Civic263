import { useColorScheme } from 'react-native';

const palettes = {
  light: {
    background: '#edf2f5',
    surface: '#ffffff',
    navigation: '#f8fbfc',
    text: '#142b38',
    muted: '#526575',
    border: '#d4dfe6',
    accent: '#007c78',
    onAccent: '#ffffff',
    tint: '#e0f2ef',
    input: '#f5f8fa',
    error: '#a32c36',
    radiusFill: 'rgba(0,124,120,0.05)',
  },
  dark: {
    background: '#172637',
    surface: '#23364a',
    navigation: '#1c2e42',
    text: '#edf4f7',
    muted: '#b5c8d9',
    border: '#3e5368',
    accent: '#78dbcf',
    onAccent: '#0c302e',
    tint: '#294b54',
    input: '#1b2e42',
    error: '#ffb4ab',
    radiusFill: 'rgba(120,219,207,0.08)',
  },
} as const;

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...palettes[scheme], scheme, radius: 12 } as const;
}

export const typography = {
  title: { fontFamily: 'PublicSans_700Bold', fontSize: 26, lineHeight: 34, letterSpacing: -0.6 },
  heading: {
    fontFamily: 'PublicSans_600SemiBold',
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.25,
  },
  body: { fontFamily: 'PublicSans_400Regular', fontSize: 15, lineHeight: 23 },
  label: { fontFamily: 'PublicSans_600SemiBold', fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: 'PublicSans_500Medium', fontSize: 12, lineHeight: 18 },
  eyebrow: {
    fontFamily: 'PublicSans_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
  },
} as const;

export const motion = { press: 120, field: 180, feedback: 200 } as const;
