/**
 * Adaptive layout rules shared by every screen. Pure, so they can be tested without a device.
 *
 * The window size class (Material window size classes, which also fit iPad multitasking and
 * foldables) chooses the navigation chrome. Pane decisions use the *content* width — the window
 * minus the sidebar or rail — so a screen never plans for space the navigation already uses.
 * Everything follows the live window width: rotation, folding and split-screen resizing
 * re-lay the app out immediately.
 */
export type WindowClass = 'compact' | 'medium' | 'expanded';
export type NavigationChrome = 'tabs' | 'rail' | 'sidebar';
export interface AdaptiveLayout {
  windowClass: WindowClass;
  /** Width of the window. */
  width: number;
  /** Navigation chrome for this window: bottom tabs, a rail, or a full sidebar. */
  navigation: NavigationChrome;
  /** Width taken by the rail or sidebar for screens inside the tab navigator (0 otherwise). */
  navWidth: number;
  /** Width available to the screen's own content. */
  contentWidth: number;
  /** True on tablets and foldables: show a list beside its detail rather than pushing pages. */
  listDetail: boolean;
  /** Width of the list pane in list/detail layouts, and of the inspector over the map. */
  listPaneWidth: number;
  /** Number of columns for grids. */
  columns: 1 | 2 | 3;
  /** Columns for the service picker grid. */
  categoryColumns: 2 | 3 | 4;
  /** Readable width for a single column of text or a form. */
  contentMaxWidth: number;
  /** Width for two-pane content. */
  wideContentMaxWidth: number;
  /** Outer padding around content. */
  gutter: number;
  /** The report composer shows a sticky summary column instead of a bottom action bar. */
  summaryColumn: boolean;
  /** Backwards-compatible aliases. */
  sidePanel: boolean;
  navigationRail: boolean;
  sidePanelWidth: number;
}
export const MEDIUM_MIN_WIDTH = 600;
export const EXPANDED_MIN_WIDTH = 840;
export const SIDEBAR_MIN_WIDTH = 1000;
export const RAIL_WIDTH = 88;
export const SIDEBAR_WIDTH = 248;

export function windowClassFor(width: number): WindowClass {
  if (width >= EXPANDED_MIN_WIDTH) return 'expanded';
  if (width >= MEDIUM_MIN_WIDTH) return 'medium';
  return 'compact';
}
export function navigationFor(width: number): NavigationChrome {
  if (width >= SIDEBAR_MIN_WIDTH) return 'sidebar';
  if (width >= MEDIUM_MIN_WIDTH) return 'rail';
  return 'tabs';
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function adaptiveLayout(
  width: number,
  options: { insideNavigation?: boolean } = {},
): AdaptiveLayout {
  const windowClass = windowClassFor(width);
  const navigation = navigationFor(width);
  const navWidth = options.insideNavigation
    ? navigation === 'sidebar'
      ? SIDEBAR_WIDTH
      : navigation === 'rail'
        ? RAIL_WIDTH
        : 0
    : 0;
  const contentWidth = width - navWidth;
  const compact = contentWidth < MEDIUM_MIN_WIDTH;
  const listDetail = contentWidth >= 640;
  const listPaneWidth = compact ? contentWidth : Math.round(clamp(contentWidth * 0.38, 300, 400));
  const gutter = windowClass === 'compact' ? 20 : windowClass === 'medium' ? 24 : 32;
  return {
    windowClass,
    width,
    navigation,
    navWidth,
    contentWidth,
    listDetail,
    listPaneWidth,
    columns: contentWidth >= 1100 ? 3 : contentWidth >= MEDIUM_MIN_WIDTH ? 2 : 1,
    categoryColumns: contentWidth >= 1100 ? 4 : contentWidth >= 700 ? 3 : 2,
    contentMaxWidth: compact ? contentWidth : 680,
    wideContentMaxWidth: compact ? contentWidth : Math.min(contentWidth, 1180),
    gutter,
    summaryColumn: contentWidth >= 720,
    sidePanel: !compact,
    navigationRail: navigation !== 'tabs',
    sidePanelWidth: listPaneWidth,
  };
}
/** Style that centres a scroll view's content in a readable column on large screens. */
export function centeredContent(layout: AdaptiveLayout, wide = false) {
  return {
    width: '100%',
    maxWidth: (wide ? layout.wideContentMaxWidth : layout.contentMaxWidth) + layout.gutter * 2,
    alignSelf: 'center',
  } as const;
}
