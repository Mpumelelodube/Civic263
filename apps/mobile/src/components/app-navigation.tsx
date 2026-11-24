import { Image } from 'expo-image';
import appIcon from '../../assets/icon.png';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, type IconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { RAIL_WIDTH, SIDEBAR_WIDTH } from '@/layout';
import { radius, spacing, useTheme } from '@/theme';

const DESTINATIONS: Record<string, { icon: IconName; label: string; short: string }> = {
  index: { icon: 'nearby', label: 'Nearby', short: 'Nearby' },
  report: { icon: 'report', label: 'Report an issue', short: 'Report' },
  community: { icon: 'reviews', label: 'Community reviews', short: 'Reviews' },
  'my-reports': { icon: 'drafts', label: 'My reports', short: 'Reports' },
};

/**
 * Large-screen navigation: a Material-style rail on medium windows (iPad portrait, foldables)
 * and a full sidebar on expanded windows (iPad landscape, large tablets). Phones keep the
 * platform bottom tab bar.
 */
export function AppNavigation({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  variant,
}: BottomTabBarProps & { variant: 'rail' | 'sidebar' }) {
  const theme = useTheme();
  const sidebar = variant === 'sidebar';
  return (
    <View
      style={{
        width: sidebar ? SIDEBAR_WIDTH : RAIL_WIDTH,
        backgroundColor: theme.navigation,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: theme.border,
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: sidebar ? spacing.md : spacing.sm,
        gap: spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: sidebar ? 'row' : 'column',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: sidebar ? spacing.sm : 0,
          paddingBottom: spacing.xxl,
        }}
      >
        <Image
          source={appIcon}
          style={{ width: 40, height: 40, borderRadius: 10, borderCurve: 'continuous' }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        {sidebar && (
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">Civic263</AppText>
            <AppText variant="caption" style={{ color: theme.muted }}>
              Public issue register
            </AppText>
          </View>
        )}
      </View>
      <View role="tablist" style={{ gap: sidebar ? spacing.xs : spacing.md }}>
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const destination = DESTINATIONS[route.name];
          const options = descriptors[route.key]?.options;
          const label = destination?.label ?? options?.title ?? route.name;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const tint = focused ? theme.accent : theme.muted;
          return sidebar ? (
            <Pressable
              key={route.key}
              role="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={({ pressed }) => ({
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: focused ? theme.tint : pressed ? theme.input : 'transparent',
              })}
            >
              <AppIcon name={destination?.icon ?? 'nearby'} size={21} color={tint} />
              <AppText
                variant="label"
                style={{ color: focused ? theme.text : theme.muted, flex: 1 }}
              >
                {label}
              </AppText>
            </Pressable>
          ) : (
            <Pressable
              key={route.key}
              role="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}
            >
              {({ pressed }) => (
                <>
                  <View
                    style={{
                      width: 56,
                      height: 32,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: focused ? theme.tint : pressed ? theme.input : 'transparent',
                    }}
                  >
                    <AppIcon name={destination?.icon ?? 'nearby'} size={21} color={tint} />
                  </View>
                  <AppText
                    variant="caption"
                    numberOfLines={1}
                    style={{ color: focused ? theme.text : theme.muted }}
                  >
                    {destination?.short ?? label}
                  </AppText>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account and recovery"
        onPress={() => router.push('/account')}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: sidebar ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: sidebar ? 'flex-start' : 'center',
          gap: sidebar ? spacing.md : spacing.xs,
          paddingHorizontal: sidebar ? spacing.md : 0,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: pressed ? theme.input : 'transparent',
        })}
      >
        <AppIcon name="account" size={21} color={theme.muted} />
        <AppText variant={sidebar ? 'label' : 'caption'} style={{ color: theme.muted }}>
          {sidebar ? 'Account and recovery' : 'Account'}
        </AppText>
      </Pressable>
    </View>
  );
}
