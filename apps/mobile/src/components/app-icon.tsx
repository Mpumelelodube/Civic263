import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTheme } from '@/theme';
import { isCategoryId } from '@civic263/domain';
import { categoryColor } from '@/category-colors';

const symbols = {
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  settings: { ios: 'slider.horizontal.3', android: 'settings', web: 'settings' },
  photos: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  send: { ios: 'paperplane', android: 'send', web: 'send' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  nearby: { ios: 'map', android: 'map', web: 'map' },
  locate: { ios: 'location', android: 'my_location', web: 'my_location' },
  report: { ios: 'plus.circle', android: 'add_circle', web: 'add_circle' },
  drafts: { ios: 'doc.text', android: 'description', web: 'description' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  edit: { ios: 'text.alignleft', android: 'notes', web: 'notes' },
  retry: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  roads: { ios: 'road.lanes', android: 'add_road', web: 'add_road' },
  'traffic-lights': { ios: 'light.beacon.max', android: 'traffic', web: 'traffic' },
  'road-signs': { ios: 'signpost.right', android: 'signpost', web: 'signpost' },
  sewer: { ios: 'water.waves', android: 'water', web: 'water' },
  water: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  stormwater: { ios: 'cloud.rain', android: 'rainy', web: 'rainy' },
  streetlights: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
  waste: { ios: 'trash', android: 'delete', web: 'delete' },
  parks: { ios: 'leaf', android: 'park', web: 'park' },
  facilities: { ios: 'building.2', android: 'apartment', web: 'apartment' },
  'dangerous-infrastructure': {
    ios: 'exclamationmark.triangle',
    android: 'warning',
    web: 'warning',
  },
  'road-obstruction': { ios: 'car', android: 'car_crash', web: 'car_crash' },
  other: { ios: 'square.grid.2x2', android: 'category', web: 'category' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof symbols;
export function AppIcon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <SymbolView
      name={symbols[name]}
      size={size}
      tintColor={color ?? (isCategoryId(name) ? categoryColor(name, theme.scheme) : theme.accent)}
      accessible={false}
    />
  );
}
