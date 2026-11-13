import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { BottomSheet } from '@/components/bottom-sheet';
import { ScrollView as SheetScrollView } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { AppState, View } from 'react-native';
import { Image } from 'expo-image';
import {
  categoryLabel,
  distanceKm,
  isOpenIncident,
  workflowLabel,
  type PublicIncident,
} from '@civic263/domain';

import { SheetAction, SheetBlock } from '@/components/sheet-content';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import MapView, { Circle, type Region } from 'react-native-maps';
import { ServicePin } from '@/components/service-pin';
import { readNearbyReports, publicPhotoUrl, invalidateNearbyReports } from '@/services/reports';
const INITIAL_CENTRE = { latitude: -17.8252, longitude: 31.0335 };
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function NearbyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useAppReducedMotion();
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({
    ...INITIAL_CENTRE,
    latitudeDelta: 0.11,
    longitudeDelta: 0.11,
  });
  const centre = region;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [published, setPublished] = useState<PublicIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        invalidateNearbyReports();
        setRefreshKey((value) => value + 1);
      };
      refresh();
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') refresh();
      }, 60000);
      const resume = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearInterval(interval);
        resume.remove();
      };
    }, []),
  );
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 30000);
    const debounce = setTimeout(() => {
      setLoading(true);
      setNetworkError(null);
      void readNearbyReports(
        { latitude: region.latitude, longitude: region.longitude },
        abort.signal,
      )
        .then((result) => {
          if (active) {
            setPublished(result.incidents);
            setTruncated(result.truncated);
          }
        })
        .catch(() => {
          if (active)
            setNetworkError('Could not refresh nearby reports. Check your connection and retry.');
        })
        .finally(() => {
          clearTimeout(timeout);
          if (active) setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      abort.abort();
      clearTimeout(debounce);
      clearTimeout(timeout);
    };
  }, [region.latitude, region.longitude, refreshKey]);
  const issues = published
    .filter(isOpenIncident)
    .flatMap((item) =>
      item.location
        ? [
            {
              ...item,
              ...item.location,
              service: categoryLabel(item.categoryId),
              distance: distanceKm(centre, item.location),
            },
          ]
        : [],
    )
    .filter((item) => item.distance <= 5)
    .sort((a, b) => a.distance - b.distance);
  const selected = issues.find((issue) => issue.id === selectedId);

  useEffect(() => {
    // Use an existing grant without interrupting the first launch with a prompt.
    void Location.getForegroundPermissionsAsync()
      .then((permission) => {
        setLocationAllowed(permission.granted);
      })
      .catch(() => setMessage('Location is unavailable. You can still browse the map.'));
  }, []);

  async function locate() {
    if (locating) return;
    setLocating(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationAllowed(permission.granted);
      if (!permission.granted) {
        setMessage('Location access is off. Move the map to browse an area.');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setMessage('Turn on device location, then try again. You can also move the map.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setRegion({ ...next, latitudeDelta: 0.11, longitudeDelta: 0.11 });
      map.current?.animateToRegion(
        { ...next, latitudeDelta: 0.11, longitudeDelta: 0.11 },
        reduced ? 0 : 300,
      );
    } catch {
      setMessage('Could not find your location. Try again or move the map.');
    } finally {
      setLocating(false);
    }
  }

  function startReport() {
    setSheetOpen(false);
    router.push('/report');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MapView
        // Android applies map appearance at creation; retain the viewport when it changes.
        key={theme.scheme}
        ref={map}
        userInterfaceStyle={theme.scheme}
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation={locationAllowed}
        showsMyLocationButton={false}
        mapPadding={{ top: insets.top + 100, right: 12, bottom: 180, left: 12 }}
        onRegionChangeComplete={(region) => {
          setRegion(region);
          setSelectedId(null);
        }}
        accessibilityLabel="Nearby public reports map. Move the map to explore a five kilometre radius."
      >
        <Circle
          center={centre}
          radius={5000}
          strokeColor={theme.accent}
          fillColor={theme.radiusFill}
          strokeWidth={1}
        />
        {issues.map((issue) => (
          <ServicePin
            key={`${issue.id}-${theme.scheme}`}
            coordinate={issue}
            demo={false}
            categoryId={issue.categoryId}
            title={issue.title}
            pending={issue.communityResolution?.status === 'awaiting-confirmation'}
            onPress={() => {
              setSelectedId(issue.id);
              setSheetOpen(true);
            }}
          />
        ))}
      </MapView>
      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          right: 16,
          backgroundColor: theme.surface,
          padding: 16,
          borderRadius: 18,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge name="nearby" />
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="heading">Explore your area</AppText>
            <AppText variant="caption" style={{ color: theme.muted }}>
              5 km from map centre
            </AppText>
          </View>
          <View
            style={{
              backgroundColor: theme.tint,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <AppText variant="eyebrow" style={{ color: theme.accent }}>
              PUBLIC
            </AppText>
          </View>
        </View>
        {networkError && (
          <View style={{ gap: 8 }}>
            <AppText accessibilityRole="alert" variant="caption" style={{ color: theme.error }}>
              {networkError}
            </AppText>
            <ActionButton
              label="Retry nearby reports"
              icon="retry"
              variant="ghost"
              onPress={() => {
                invalidateNearbyReports();
                setRefreshKey((value) => value + 1);
              }}
            />
          </View>
        )}
        {message && (
          <AppText accessibilityRole="alert" variant="caption" style={{ color: theme.error }}>
            {message}
          </AppText>
        )}
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          left: 16,
          right: 16,
          backgroundColor: theme.surface,
          padding: 16,
          borderRadius: 22,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            backgroundColor: theme.border,
            borderRadius: 2,
            alignSelf: 'center',
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="heading">Around here</AppText>
            <AppText variant="caption" style={{ color: theme.muted }}>
              {loading
                ? 'Refreshing nearby reports...'
                : `${issues.length} published reports within 5 km`}
            </AppText>
          </View>
          <ActionButton
            label={locating ? 'Locating...' : 'Locate'}
            icon="locate"
            variant="ghost"
            busy={locating}
            onPress={() => {
              void locate();
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ActionButton
            label="New report"
            icon="report"
            onPress={startReport}
            style={{ flex: 1 }}
          />
          <ActionButton
            label="View issues"
            icon="nearby"
            variant="secondary"
            onPress={() => {
              setSelectedId(null);
              setSheetOpen(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </View>
      <BottomSheet isPresented={sheetOpen} onDismiss={() => setSheetOpen(false)}>
        <SheetScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 20, width: '100%', padding: 20, paddingBottom: 40 }}>
            <SheetBlock>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBadge name={selected ? selected.categoryId : 'nearby'} />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="heading">
                    {selected ? selected.title : 'Around this area'}
                  </AppText>
                  <AppText variant="caption" style={{ color: theme.muted }}>
                    Published observations - within 5 km
                  </AppText>
                </View>
              </View>
              <AppText style={{ color: theme.muted }}>
                Resident observations after automatic publication checks. Distances use approximate
                public positions. Publication does not confirm a municipal response.
              </AppText>
            </SheetBlock>
            {selected && (
              <SheetBlock>
                <AppText>{selected.summary}</AppText>
                <AppText style={{ color: theme.accent }}>{workflowLabel(selected)}</AppText>
                {!!selected.photoCount && (
                  <Image
                    source={{ uri: publicPhotoUrl(selected.id, 0) }}
                    style={{ width: '100%', height: 190, borderRadius: 14 }}
                    contentFit="cover"
                    accessibilityLabel="Approved public report photo"
                  />
                )}
                <ActionButton
                  label="View report and photos"
                  icon="photos"
                  onPress={() => {
                    setSheetOpen(false);
                    router.push({
                      pathname: '/report-details',
                      params: { id: selected.id, view: 'public' },
                    });
                  }}
                />
              </SheetBlock>
            )}
            {truncated && (
              <AppText variant="caption" style={{ color: theme.muted }}>
                This busy area contains more reports than this view can load. Move the map to focus
                on a smaller area.
              </AppText>
            )}
            <SheetAction label="Start a report draft" icon="report" onPress={startReport} primary />
            {(selected ? [selected] : issues).map((issue) => (
              <SheetAction
                key={issue.id}
                label={issue.title}
                detail={`${issue.service} - ${issue.distance.toFixed(1)} km`}
                icon={issue.categoryId}
                onPress={() => {
                  setSheetOpen(false);
                  router.push({
                    pathname: '/report-details',
                    params: { id: issue.id, view: 'public' },
                  });
                }}
              />
            ))}
            {issues.length === 0 && !loading && !networkError && (
              <SheetBlock>
                <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
                  <IconBadge name="nearby" size={64} />
                  <AppText variant="heading">No published reports nearby yet</AppText>
                  <AppText style={{ color: theme.muted, textAlign: 'center' }}>
                    This does not mean the area has no issues. New reports appear after they pass
                    automatic checks. You can report an issue or move the map to browse another
                    area.
                  </AppText>
                </View>
              </SheetBlock>
            )}
            <SheetAction label="Back to map" icon="nearby" onPress={() => setSheetOpen(false)} />
          </View>
        </SheetScrollView>
      </BottomSheet>
    </View>
  );
}
