import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import { uuid } from 'expo';
import type {
  CategoryId,
  PlaceSuggestion,
  ReportLocation as LocationValue,
} from '@civic263/domain';
import { FormField } from './form-field';
import { AppText } from './app-text';
import { AppIcon } from './app-icon';
import { ActionButton } from './action-button';
import { LocationPicker } from './location-picker';
import { placeDetails, placeLookupError, searchPlaces } from '@/services/places';
import { useTheme } from '@/theme';

export function ReportLocationField({
  value,
  location,
  categoryId,
  disabled,
  onChangeText,
  onLocationChange,
  onBusyChange,
}: {
  value: string;
  location: LocationValue | undefined;
  categoryId: CategoryId;
  disabled: boolean;
  onChangeText: (value: string) => void;
  onLocationChange: (value: LocationValue | undefined) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const theme = useTheme();
  const session = useRef<string | null>(null);
  const version = useRef(0);
  const mounted = useRef(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{
    autoLocate: boolean;
    initial?: { location: LocationValue; label: string };
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      version.current += 1;
    };
  }, []);
  useEffect(() => {
    const requestVersion = ++version.current;
    if (query.trim().length < 3 || disabled) {
      setSearching(false);
      setSuggestions(null);
      return;
    }
    setSearching(true);
    setSuggestions(null);
    setError(null);
    const token = session.current ?? (session.current = uuid.v4());
    const timer = setTimeout(() => {
      void searchPlaces(query, token)
        .then((items) => {
          if (mounted.current && requestVersion === version.current) setSuggestions(items);
        })
        .catch(() => {
          if (mounted.current && requestVersion === version.current) setError(placeLookupError());
        })
        .finally(() => {
          if (mounted.current && requestVersion === version.current) setSearching(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      version.current += 1;
    };
  }, [query, disabled]);
  function stopSearch() {
    version.current += 1;
    setQuery('');
    setSuggestions(null);
    setSearching(false);
    setError(null);
    Keyboard.dismiss();
  }
  function openMap(autoLocate: boolean) {
    stopSearch();
    setPicker({ autoLocate, ...(location ? { initial: { location, label: value } } : {}) });
  }
  async function select(suggestion: PlaceSuggestion) {
    if (selecting || !session.current) return;
    const token = session.current;
    stopSearch();
    setSelecting(true);
    onBusyChange(true);
    try {
      const place = await placeDetails(suggestion.placeId, token);
      if (!mounted.current) return;
      const point: LocationValue = {
        latitude: place.latitude,
        longitude: place.longitude,
        source: 'place',
        placeId: suggestion.placeId,
      };
      setPicker({ autoLocate: false, initial: { location: point, label: place.label } });
      session.current = null;
    } catch {
      if (mounted.current)
        setError('Could not open that place. Try again, or choose the spot on the map.');
    } finally {
      if (mounted.current) {
        setSelecting(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <FormField
        label="Location or landmark"
        icon="search"
        hint="Search for an address or place, or enter a landmark yourself."
        value={value}
        maxLength={200}
        placeholder="Search a road, address or landmark"
        editable={!disabled && !selecting}
        autoCorrect={false}
        returnKeyType="search"
        onChangeText={(text) => {
          onChangeText(text);
          onLocationChange(undefined);
          setQuery(text);
        }}
      />
      {(searching || selecting) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <AppText variant="caption" style={{ color: theme.muted }}>
            {selecting ? 'Opening that place...' : 'Searching places...'}
          </AppText>
        </View>
      )}
      {suggestions && (
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: theme.surface,
          }}
        >
          {suggestions.map((item) => (
            <Pressable
              key={item.placeId}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${item.title}, ${item.subtitle}`}
              onPress={() => {
                void select(item);
              }}
              style={({ pressed }) => ({
                padding: 14,
                gap: 5,
                backgroundColor: pressed ? theme.tint : theme.surface,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              })}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <AppIcon name="pin" size={20} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{item.title}</AppText>
                  {!!item.subtitle && (
                    <AppText variant="caption" style={{ color: theme.muted }}>
                      {item.subtitle}
                    </AppText>
                  )}
                </View>
                <AppIcon name="chevron" size={18} />
              </View>
            </Pressable>
          ))}
          {suggestions.length === 0 && (
            <AppText variant="caption" style={{ padding: 14, color: theme.muted }}>
              No matching places. Try a different search or pick from the map.
            </AppText>
          )}
          <AppText
            style={{
              padding: 12,
              textAlign: 'right',
              fontSize: 12,
              lineHeight: 18,
              color: theme.scheme === 'dark' ? '#FFFFFF' : '#5E5E5E',
            }}
          >
            Google Maps
          </AppText>
        </View>
      )}
      {error && (
        <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.muted }}>
          {error}
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ActionButton
          label="Pick from map"
          icon="nearby"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={disabled || selecting}
          onPress={() => openMap(false)}
        />
        <ActionButton
          label="Current location"
          icon="locate"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={disabled || selecting}
          onPress={() => openMap(true)}
        />
      </View>
      {!location && (
        <AppText variant="caption" style={{ color: theme.muted }}>
          Confirm a map pin before sending. This is where future on-site updates will be checked.
        </AppText>
      )}
      {location && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppIcon name="check" size={17} />
          <AppText variant="caption" style={{ color: theme.muted, flex: 1 }}>
            Pin selected: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </AppText>
        </View>
      )}
      {location && !value.startsWith('Map pin:') && (
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
      {picker && (
        <LocationPicker
          categoryId={categoryId}
          autoLocate={picker.autoLocate}
          {...(picker.initial ? { initial: picker.initial } : {})}
          onClose={() => setPicker(null)}
          onConfirm={(selection) => {
            onChangeText(selection.label);
            onLocationChange(selection.location);
            setPicker(null);
            session.current = null;
          }}
        />
      )}
    </View>
  );
}
