/**
 * Adaptive layout rules shared by every screen. Pure, so it can be tested without a device.
 * Size classes follow Material window size classes, which also suit iPad multitasking widths
 * and foldables: the class follows the current window width, so unfolding a phone, rotating a
 * tablet or resizing a split-screen window re-lays the app out immediately.
 */
export type WindowClass = 'compact' | 'medium' | 'expanded';
export interface AdaptiveLayout {
  windowClass: WindowClass;
  /** Width of the window in dp/points. */
  width: number;
  /** A persistent list/detail panel beside the map or content (medium and larger). */
  sidePanel: boolean;
  /** Navigation moves from a bottom tab bar to a left rail (expanded only). */
  navigationRail: boolean;
  /** Number of content columns for card grids and forms. */
  columns: 1 | 2 | 3;
  /** Maximum readable width for a single column of content. */
  contentMaxWidth: number;
  /** Maximum width for two-pane content such as the report form or details. */
  wideContentMaxWidth: number;
  /** Outer padding around content. */
  gutter: number;
  /** Width of the side panel when shown. */
  sidePanelWidth: number;
}
export const MEDIUM_MIN_WIDTH = 600;
export const EXPANDED_MIN_WIDTH = 840;
export function windowClassFor(width: number): WindowClass {
  if (width >= EXPANDED_MIN_WIDTH) return 'expanded';
  if (width >= MEDIUM_MIN_WIDTH) return 'medium';
  return 'compact';
}
export function adaptiveLayout(width: number): AdaptiveLayout {
  const windowClass = windowClassFor(width);
  if (windowClass === 'compact')
    return {
      windowClass,
      width,
      sidePanel: false,
      navigationRail: false,
      columns: 1,
      contentMaxWidth: width,
      wideContentMaxWidth: width,
      gutter: 20,
      sidePanelWidth: 0,
    };
  if (windowClass === 'medium')
    return {
      windowClass,
      width,
      sidePanel: true,
      navigationRail: false,
      columns: 2,
      contentMaxWidth: 640,
      wideContentMaxWidth: Math.min(width, 840),
      gutter: 24,
      sidePanelWidth: Math.min(360, Math.round(width * 0.42)),
    };
  return {
    windowClass,
    width,
    sidePanel: true,
    navigationRail: true,
    columns: width >= 1200 ? 3 : 2,
    contentMaxWidth: 720,
    wideContentMaxWidth: 1100,
    gutter: 32,
    sidePanelWidth: width >= 1200 ? 440 : 400,
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
