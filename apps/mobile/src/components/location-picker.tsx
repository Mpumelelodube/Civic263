import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CategoryId, LocatedPlace, ReportLocation } from '@civic263/domain';
import { AppText } from './app-text';
import { AppIcon } from './app-icon';
import { ActionButton } from './action-button';
import { ServicePin } from './service-pin';
import { DEMO_CENTRE } from '@/services/nearby-examples';
import { reverseGeocode } from '@/services/places';
import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';

type Selection = { location: ReportLocation; label: string };
export function LocationPicker({
  initial,
  categoryId,
  autoLocate,
  onClose,
  onConfirm,
}: {
  initial?: Selection;
  categoryId: CategoryId;
  autoLocate: boolean;
  onClose: () => void;
  onConfirm: (selection: Selection) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useAppReducedMotion();
  const map = useRef<MapView>(null);
  const active = useRef(true);
  const lookupVersion = useRef(0);
  const locatingRef = useRef(false);
  const gpsVersion = useRef(0);
  const [point, setPoint] = useState<ReportLocation>(
    initial?.location ?? { ...DEMO_CENTRE, source: 'map' },
  );
  const [label, setLabel] = useState(initial?.label ?? '');
  const [locating, setLocating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function movePin(location: ReportLocation) {
    if (location.source === 'map') {
      gpsVersion.current += 1;
      locatingRef.current = false;
      setLocating(false);
    }
    lookupVersion.current += 1;
    setPoint(location);
    setLabel('');
    setMessage(null);
  }
  useEffect(() => {
    if (initial && point === initial.location) return;
    const version = ++lookupVersion.current;
    setLookingUp(true);
    const timer = setTimeout(() => {
      void reverseGeocode(point.latitude, point.longitude)
        .then((place: LocatedPlace) => {
          if (active.current && version === lookupVersion.current) setLabel(place.label);
        })
        .catch(() => {
          if (active.current && version === lookupVersion.current)
            setMessage(
              (current) => current ?? 'No address available. The pin still marks your chosen spot.',
            );
        })
        .finally(() => {
          if (active.current && version === lookupVersion.current) setLookingUp(false);
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      lookupVersion.current += 1;
    };
  }, [point, initial]);

  async function locate() {
    if (locatingRef.current) return;
    const requestVersion = ++gpsVersion.current;
    locatingRef.current = true;
    setLocating(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active.current || requestVersion !== gpsVersion.current) return;
      setAllowed(permission.granted);
      if (!permission.granted) {
        setMessage('Location access is off. Drag the pin or tap the map to choose the spot.');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setMessage('Device location is off. You can still move the pin yourself.');
        return;
      }
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Location timed out.')), 15000);
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
      if (!active.current || requestVersion !== gpsVersion.current) return;
      const location: ReportLocation = {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        source: 'current',
      };
      movePin(location);
      map.current?.animateToRegion(
        { ...location, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        reduced ? 0 : 300,
      );
    } catch {
      if (active.current && requestVersion === gpsVersion.current)
        setMessage('Could not find your position. Drag the pin to the right spot.');
    } finally {
      if (requestVersion === gpsVersion.current) {
        locatingRef.current = false;
        if (active.current) setLocating(false);
      }
    }
  }
  useEffect(() => {
    active.current = true;
    if (autoLocate) void locate();
    else
      void Location.getForegroundPermissionsAsync()
        .then((permission) => {
          if (active.current) setAllowed(permission.granted);
        })
        .catch(() => {});
    return () => {
      active.current = false;
      gpsVersion.current += 1;
      lookupVersion.current += 1;
    };
    // The user's explicit opening action determines whether this modal requests GPS.
  }, []);
  const coordinates = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  return (
    <Modal
      visible
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <MapView
          key={theme.scheme}
          ref={map}
          userInterfaceStyle={theme.scheme}
          style={{ flex: 1 }}
          initialRegion={{ ...point, latitudeDelta: 0.018, longitudeDelta: 0.018 }}
          showsUserLocation={allowed}
          showsMyLocationButton={false}
          mapPadding={{ top: insets.top + 110, right: 12, bottom: insets.bottom + 260, left: 12 }}
          onPress={(event) => movePin({ ...event.nativeEvent.coordinate, source: 'map' })}
          onLongPress={(event) => movePin({ ...event.nativeEvent.coordinate, source: 'map' })}
          accessibilityLabel="Choose report location. Drag the pin or tap the map."
        >
          <ServicePin
            key={theme.scheme}
            coordinate={point}
            categoryId={categoryId}
            title="Report location"
            demo={false}
            draggable
            onPress={() => {}}
            onDragEnd={(coordinate) => movePin({ ...coordinate, source: 'map' })}
          />
        </MapView>
        <View
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 16,
            right: 16,
            padding: 16,
            gap: 8,
            borderRadius: 20,
            backgroundColor: theme.surface,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="heading">Choose the exact spot</AppText>
              <AppText variant="caption" style={{ color: theme.muted }}>
                Touch and hold the pin to drag, or tap the map.
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close location map"
              onPress={onClose}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="close" />
            </Pressable>
          </View>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 12,
            left: 16,
            right: 16,
            borderRadius: 20,
            padding: 18,
            gap: 12,
            backgroundColor: theme.surface,
          }}
        >
          <AppText variant="label" accessibilityLiveRegion="polite">
            {lookingUp ? 'Finding the address...' : label || 'Your chosen pin location'}
          </AppText>
          {label && (
            <AppText
              style={{
                fontSize: 12,
                lineHeight: 18,
                color: theme.scheme === 'dark' ? '#FFFFFF' : '#5E5E5E',
              }}
            >
              Google Maps
            </AppText>
          )}
          <AppText variant="caption" selectable style={{ color: theme.muted }}>
            {coordinates}
          </AppText>
          {message && (
            <AppText
              accessibilityLiveRegion="polite"
              variant="caption"
              style={{ color: theme.muted }}
            >
              {message}
            </AppText>
          )}
          <ActionButton
            label={locating ? 'Finding your position...' : 'Use current location'}
            icon="locate"
            variant="secondary"
            busy={locating}
            onPress={() => {
              void locate();
            }}
          />
          <ActionButton
            label="Use this location"
            icon="check"
            disabled={locating}
            onPress={() =>
              onConfirm({ location: point, label: label || `Map pin: ${coordinates}` })
            }
          />
        </View>
      </View>
    </Modal>
  );
}
