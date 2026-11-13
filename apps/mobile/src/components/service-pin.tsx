import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import { categoryLabel, type CategoryId } from '@civic263/domain';
import { AppIcon } from './app-icon';
import { useTheme } from '@/theme';
import { categoryColor } from '@/category-colors';

export function ServicePin({
  coordinate,
  categoryId,
  title,
  onPress,
  demo = true,
  draggable = false,
  onDragEnd,
  pending = false,
}: {
  coordinate: LatLng;
  categoryId: CategoryId;
  title: string;
  onPress: () => void;
  demo?: boolean;
  draggable?: boolean;
  onDragEnd?: (coordinate: LatLng) => void;
  pending?: boolean;
}) {
  const theme = useTheme();
  const color = categoryColor(categoryId, theme.scheme);
  const marker = useRef<ComponentRef<typeof Marker>>(null);
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    // Give Android time to include the symbol in its marker bitmap, then stop tracking.
    const timer = setTimeout(() => {
      marker.current?.redraw();
      setTracking(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [pending]);
  return (
    <Marker
      ref={marker}
      coordinate={coordinate}
      title={demo ? `Demo: ${title}` : title}
      description={`${categoryLabel(categoryId)}${pending ? ' · Fix reported, awaiting community confirmation' : ''}`}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracking}
      onPress={onPress}
      draggable={draggable}
      onDragEnd={(event) => onDragEnd?.(event.nativeEvent.coordinate)}
    >
      <View
        collapsable={false}
        accessibilityLabel={`${categoryLabel(categoryId)}: ${title}`}
        style={{ width: 52, height: 62, alignItems: 'center', paddingTop: 7 }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.surface,
            borderWidth: 2,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name={categoryId} size={25} color={color} />
          {pending && (
            <View
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: theme.scheme === 'dark' ? '#f1c870' : '#8b5b08',
                borderWidth: 2,
                borderColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon
                name="clock"
                size={12}
                color={theme.scheme === 'dark' ? '#172637' : '#ffffff'}
              />
            </View>
          )}
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderTopWidth: 11,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: color,
            marginTop: -1,
          }}
        />
      </View>
    </Marker>
  );
}
