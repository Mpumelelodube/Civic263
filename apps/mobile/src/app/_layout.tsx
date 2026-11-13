import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/theme';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getReportingServices, intakeEnabled } from '@/services/firebase';
import { CommunityRuntime } from '@/components/community-runtime';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const theme = useTheme();
  const [sessionKey, setSessionKey] = useState('loading-identity');
  useEffect(() => {
    if (!intakeEnabled) return;
    return onAuthStateChanged(getReportingServices().auth, (user) =>
      setSessionKey(user?.uid ?? 'signed-out'),
    );
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
  });
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background,
      card: theme.navigation,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
      notification: theme.error,
    },
  };
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.navigation }}>
      <KeyboardProvider>
        <ThemeProvider key={sessionKey} value={navigationTheme}>
          <CommunityRuntime />
          <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="report-details" />
            <Stack.Screen name="community-visit" />
            <Stack.Screen name="account" />
            <Stack.Screen name="field-test" />
          </Stack>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
