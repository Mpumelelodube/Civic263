import { useWindowDimensions } from 'react-native';
import { adaptiveLayout, type AdaptiveLayout } from '@/layout';

/** Re-evaluates on rotation, fold/unfold and split-screen or Stage Manager resizing. */
export function useLayout(): AdaptiveLayout {
  const { width } = useWindowDimensions();
  return adaptiveLayout(width);
}
