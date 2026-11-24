import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { BottomSheet } from '@/components/bottom-sheet';
import { ScrollView as SheetScrollView } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import {
  categoryLabel,
  distanceKm,
  isOpenIncident,
  workflowLabel,
  type CategoryId,
  type PublicIncident,
} from '@civic263/domain';

import { SheetAction, SheetBlock } from '@/components/sheet-content';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import { AppIcon, type IconName } from '@/components/app-icon';
import { FilterChip, ListRow, PaneHeader, SummaryStrip } from '@/components/pane';
import { ReportDetailsView } from '@/screens/report-details-screen';
import MapView, { Circle, type Region } from 'react-native-maps';
import { ServicePin } from '@/components/service-pin';
import { readNearbyReports, publicPhotoUrl, invalidateNearbyReports } from '@/services/reports';
const INITIAL_CENTRE = { latitude: -17.8252, longitude: 31.0335 };
import { radius, spacing, useTheme } from '@/theme';
import { useLayout } from '@/hooks/use-layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function NearbyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
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
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const programmaticMove = useRef(false);
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

  const detail = (
    <View style={{ gap: 20, width: '100%', padding: 20, paddingBottom: 40 }}>
      <SheetBlock>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge name={selected ? selected.categoryId : 'nearby'} />
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="heading">{selected ? selected.title : 'Around this area'}</AppText>
            <AppText variant="caption" style={{ color: theme.muted }}>
              Published observations - within 5 km
            </AppText>
          </View>
        </View>
        <AppText style={{ color: theme.muted }}>
          Resident observations after automatic publication checks. Distances use approximate public
          positions. Publication does not confirm a municipal response.
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
          This busy area contains more reports than this view can load. Move the map to focus on a
          smaller area.
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
              automatic checks. You can report an issue or move the map to browse another area.
            </AppText>
          </View>
        </SheetBlock>
      )}
      {
        <SheetAction
          label="Back to map"
          icon="nearby"
          onPress={() => {
            setSheetOpen(false);
            setSelectedId(null);
          }}
        />
      }
    </View>
  );
  const visibleIssues = filter === 'all' ? issues : issues.filter((i) => i.categoryId === filter);
  const categoryCounts = [
    ...issues.reduce(
      (counts, issue) => counts.set(issue.categoryId, (counts.get(issue.categoryId) ?? 0) + 1),
      new Map<CategoryId, number>(),
    ),
  ].sort((a, b) => b[1] - a[1]);
  const awaiting = issues.filter(
    (issue) => issue.communityResolution?.status === 'awaiting-confirmation',
  ).length;
  function onRegionSettled(next: Region) {
    // A pan to show a chosen pin keeps the current search area and list.
    if (programmaticMove.current) {
      programmaticMove.current = false;
      return;
    }
    setRegion(next);
    setSelectedId(null);
  }
  function focusIssue(issue: { id: string; latitude: number; longitude: number }) {
    setSelectedId(issue.id);
    programmaticMove.current = true;
    // If the map is already there, no region event follows; never let the flag swallow the
    // resident's next real pan.
    setTimeout(() => {
      programmaticMove.current = false;
    }, 1200);
    map.current?.animateCamera(
      { center: { latitude: issue.latitude, longitude: issue.longitude } },
      { duration: reduced ? 0 : 350 },
    );
  }
  const mapView = (padding: { top: number; right: number; bottom: number; left: number }) => (
    <MapView
      // Android applies map appearance at creation; retain the viewport when it changes.
      key={theme.scheme}
      ref={map}
      userInterfaceStyle={theme.scheme}
      style={{ flex: 1 }}
      initialRegion={region}
      showsUserLocation={locationAllowed}
      showsMyLocationButton={false}
      mapPadding={padding}
      onRegionChangeComplete={onRegionSettled}
      accessibilityLabel="Nearby public reports map. Move the map to explore a five kilometre radius."
    >
      <Circle
        center={centre}
        radius={5000}
        strokeColor={theme.accent}
        fillColor={theme.radiusFill}
        strokeWidth={1}
      />
      {(layout.sidePanel ? visibleIssues : issues).map((issue) => (
        <ServicePin
          key={`${issue.id}-${theme.scheme}`}
          coordinate={issue}
          demo={false}
          categoryId={issue.categoryId}
          title={issue.title}
          pending={issue.communityResolution?.status === 'awaiting-confirmation'}
          onPress={() => {
            setSelectedId(issue.id);
            if (layout.sidePanel) setDetailId(null);
            else setSheetOpen(true);
          }}
        />
      ))}
    </MapView>
  );
  if (layout.sidePanel) {
    // Tablets and foldables: full-bleed map with a floating inspector (list, filters, preview
    // and full details) on the left and map controls on the right.
    const inspectorWidth = layout.listPaneWidth;
    const edge = spacing.lg;
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {mapView({
          top: insets.top + edge,
          right: edge + 56,
          bottom: insets.bottom + edge,
          left: inspectorWidth + edge * 2,
        })}
        <View
          style={{ position: 'absolute', top: insets.top + edge, right: edge, gap: spacing.sm }}
        >
          <MapControl
            icon="locate"
            label={locating ? 'Finding your location' : 'Show my location'}
            busy={locating}
            onPress={() => void locate()}
          />
          <MapControl
            icon="retry"
            label="Refresh nearby reports"
            busy={loading}
            onPress={() => {
              invalidateNearbyReports();
              setRefreshKey((value) => value + 1);
            }}
          />
        </View>
        <View
          style={{
            position: 'absolute',
            top: insets.top + edge,
            left: edge,
            bottom: insets.bottom + edge,
            width: inspectorWidth,
            backgroundColor: theme.surface,
            borderRadius: radius.xl,
            borderCurve: 'continuous',
            boxShadow: theme.shadowRaised,
            overflow: 'hidden',
          }}
        >
          {detailId ? (
            <View style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to nearby issues"
                onPress={() => setDetailId(null)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  minHeight: 52,
                  paddingHorizontal: spacing.lg,
                  backgroundColor: pressed ? theme.input : 'transparent',
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                })}
              >
                <AppIcon name="back" size={18} />
                <AppText variant="label" style={{ color: theme.accent }}>
                  Nearby issues
                </AppText>
              </Pressable>
              <View style={{ flex: 1 }}>
                <ReportDetailsView key={detailId} id={detailId} view="public" embedded />
              </View>
            </View>
          ) : (
            <SheetScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
            >
              <PaneHeader
                eyebrow="PUBLIC REGISTER"
                title="Explore your area"
                subtitle={
                  loading && issues.length
                    ? 'Refreshing published reports…'
                    : 'Published reports within 5 km of the map centre. Move the map to search another area.'
                }
              />
              <SummaryStrip
                items={[
                  { label: 'Open', value: issues.length },
                  { label: 'Awaiting check', value: awaiting },
                  { label: 'Services', value: categoryCounts.length },
                ]}
              />
              <ActionButton label="Report an issue here" icon="report" onPress={startReport} />
              {networkError && (
                <View style={{ gap: spacing.sm }}>
                  <AppText accessibilityRole="alert" selectable style={{ color: theme.error }}>
                    {networkError}
                  </AppText>
                  <ActionButton
                    label="Retry nearby reports"
                    icon="retry"
                    variant="secondary"
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
              {categoryCounts.length > 1 && (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="eyebrow" style={{ color: theme.muted }}>
                    FILTER BY SERVICE
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <FilterChip
                      label="All"
                      count={issues.length}
                      selected={filter === 'all'}
                      onPress={() => setFilter('all')}
                    />
                    {categoryCounts.map(([id, count]) => (
                      <FilterChip
                        key={id}
                        label={categoryLabel(id)}
                        icon={id}
                        count={count}
                        selected={filter === id}
                        onPress={() => {
                          setFilter(filter === id ? 'all' : id);
                          setSelectedId(null);
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
              {selected && visibleIssues.some((issue) => issue.id === selected.id) && (
                <View
                  style={{
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    backgroundColor: theme.input,
                  }}
                >
                  {!!selected.photoCount && (
                    <Image
                      source={{ uri: publicPhotoUrl(selected.id, 0) }}
                      style={{
                        width: '100%',
                        aspectRatio: 16 / 10,
                        borderRadius: radius.md,
                        borderCurve: 'continuous',
                      }}
                      contentFit="cover"
                      accessibilityLabel="Approved public report photo"
                    />
                  )}
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="heading">{selected.title}</AppText>
                    <AppText variant="caption" style={{ color: theme.accent }}>
                      {workflowLabel(selected)}
                    </AppText>
                  </View>
                  <AppText numberOfLines={4}>{selected.summary}</AppText>
                  <AppText variant="caption" style={{ color: theme.muted }}>
                    {selected.service} · {selected.distance.toFixed(1)} km from the map centre
                  </AppText>
                  <ActionButton
                    label="View full report"
                    icon="photos"
                    variant="secondary"
                    onPress={() => setDetailId(selected.id)}
                  />
                </View>
              )}
              <View style={{ gap: 2 }}>
                {loading && !issues.length && !networkError ? (
                  <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}>
                    <ActivityIndicator color={theme.accent} />
                    <AppText style={{ color: theme.muted }}>Loading nearby reports…</AppText>
                  </View>
                ) : (
                  visibleIssues.map((issue) => (
                    <ListRow
                      key={issue.id}
                      icon={issue.categoryId}
                      title={issue.title}
                      status={workflowLabel(issue)}
                      meta={`${issue.service} · ${issue.distance.toFixed(1)} km`}
                      selected={issue.id === selectedId}
                      onPress={() => focusIssue(issue)}
                    />
                  ))
                )}
              </View>
              {issues.length === 0 && !loading && !networkError && (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="heading">No published reports nearby yet</AppText>
                  <AppText style={{ color: theme.muted }}>
                    This does not mean the area has no issues. New reports appear after they pass
                    automatic checks. Report an issue, or move the map to browse another area.
                  </AppText>
                </View>
              )}
              {truncated && (
                <AppText variant="caption" style={{ color: theme.muted }}>
                  This busy area contains more reports than can load at once. Zoom in to focus on a
                  smaller area.
                </AppText>
              )}
            </SheetScrollView>
          )}
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {mapView({ top: insets.top + 100, right: 12, bottom: 180, left: 12 })}
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
          {detail}
        </SheetScrollView>
      </BottomSheet>
    </View>
  );
}

/** A round floating control over the map (large screens). */
function MapControl({
  icon,
  label,
  busy = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.tint : theme.surface,
        boxShadow: theme.shadowRaised,
      })}
    >
      {busy ? <ActivityIndicator color={theme.accent} /> : <AppIcon name={icon} size={21} />}
    </Pressable>
  );
}
