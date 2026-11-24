import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { typography, useTheme } from '@/theme';
import { InsideNavigationContext, useLayout } from '@/hooks/use-layout';
import { AppNavigation } from '@/components/app-navigation';

export default function TabLayout() {
  const theme = useTheme();
  const layout = useLayout();
  const chrome = layout.navigation;
  return (
    <InsideNavigationContext value={true}>
      <Tabs
        // Phones: the platform bottom tab bar. Tablets and foldables: a rail or a full sidebar.
        tabBar={
          chrome === 'tabs' ? undefined : (props) => <AppNavigation {...props} variant={chrome} />
        }
        screenOptions={{
          headerShown: false,
          tabBarLabelStyle: { ...typography.caption, fontWeight: 'normal' },
          animation: 'none',
          tabBarPosition: chrome === 'tabs' ? 'bottom' : 'left',
          tabBarStyle: { backgroundColor: theme.navigation, borderTopColor: theme.border },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.muted,
          sceneStyle: { backgroundColor: theme.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Nearby',
            tabBarIcon: ({ color, size, focused }) => (
              <SymbolView
                name={{ ios: focused ? 'map.fill' : 'map', android: 'map', web: 'map' }}
                tintColor={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'Report an issue',
            tabBarLabel: 'Report',
            tabBarIcon: ({ color, size, focused }) => (
              <SymbolView
                name={{
                  ios: focused ? 'plus.circle.fill' : 'plus.circle',
                  android: 'add_circle',
                  web: 'add_circle',
                }}
                tintColor={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarLabel: 'Reviews',
            tabBarIcon: ({ color, size }) => (
              <SymbolView
                name={{ ios: 'checkmark.seal', android: 'verified', web: 'verified' }}
                tintColor={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="my-reports"
          options={{
            title: 'My reports',
            tabBarIcon: ({ color, size, focused }) => (
              <SymbolView
                name={{
                  ios: focused ? 'doc.text.fill' : 'doc.text',
                  android: 'description',
                  web: 'description',
                }}
                tintColor={color}
                size={size}
              />
            ),
          }}
        />
      </Tabs>
    </InsideNavigationContext>
  );
}
