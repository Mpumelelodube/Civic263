import { createContext, use } from 'react';
import { useWindowDimensions } from 'react-native';
import { adaptiveLayout, type AdaptiveLayout } from '@/layout';

/** True for screens rendered inside the tab navigator, beside its rail or sidebar. */
export const InsideNavigationContext = createContext(false);

/** Re-evaluates on rotation, fold/unfold and split-screen or Stage Manager resizing. */
export function useLayout(): AdaptiveLayout {
  const { width } = useWindowDimensions();
  const insideNavigation = use(InsideNavigationContext);
  return adaptiveLayout(width, { insideNavigation });
}
