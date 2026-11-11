import { Tabs } from 'expo-router';
import { theme } from '@/theme';
export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarIconStyle: { display: 'none' },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Nearby' }} />
      <Tabs.Screen name="report" options={{ title: 'Report an issue' }} />
      <Tabs.Screen name="my-reports" options={{ title: 'My reports' }} />
    </Tabs>
  );
}
