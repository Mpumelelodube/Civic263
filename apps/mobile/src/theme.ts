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
    // Elevation for surfaces floating over the map or content (large screens).
    shadowRaised: '0 1px 2px rgba(20, 43, 56, 0.06), 0 8px 24px rgba(20, 43, 56, 0.10)',
    shadowOverlay: '0 16px 48px rgba(20, 43, 56, 0.20)',
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
    shadowRaised: '0 1px 2px rgba(0, 0, 0, 0.30), 0 8px 24px rgba(0, 0, 0, 0.32)',
    shadowOverlay: '0 16px 48px rgba(0, 0, 0, 0.50)',
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

/** 4-point spacing scale. Row gaps < group gaps < section gaps. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const;

/** Corner radii; pair with `borderCurve: 'continuous'`. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

/** Larger headings on tablets, where the type has room to lead the layout. */
export const tabletTypography = {
  title: { fontFamily: 'PublicSans_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  heading: {
    fontFamily: 'PublicSans_600SemiBold',
    fontSize: 19,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  body: { fontFamily: 'PublicSans_400Regular', fontSize: 16, lineHeight: 24 },
} as const;
