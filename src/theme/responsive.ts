import { useWindowDimensions } from 'react-native';

/**
 * Screen-size media queries, in dp: the density-independent unit React Native
 * lays out in. A phone's pixel resolution only matters through its density, so
 * the phones we support come down to two layouts:
 *
 *   QHD+  3120 × 1440 px at 560 dpi → 411 × 891 dp
 *   FHD+  2340 × 1080 px at 420 dpi → 411 × 891 dp
 *   HD+   1560 × 720 px  at 320 dpi → 360 × 780 dp   compact and short
 *
 * Android's Display size setting moves these (an FHD+ phone zoomed in is 360 dp
 * wide) and Font size scales text on top, so query dp and fontScale, never pixels.
 */
export const breakpoints = {
  /** Narrower than this is compact: HD+ phones, and bigger ones on a large display size. */
  compactWidth: 380,
  /** Shorter than this is short: HD+ phones are 780–800 dp tall. */
  shortHeight: 820,
} as const;

/** Screens are designed at the FHD+/QHD+ size; smaller windows scale down from it. */
export const designSize = { width: 411, height: 891 } as const;

/** A CSS-style media query in dp. Every bound given must hold; bounds are inclusive. */
export interface MediaQuery {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export function matchesMedia(query: MediaQuery, window: { width: number; height: number }): boolean {
  return (
    window.width >= (query.minWidth ?? 0) &&
    window.width <= (query.maxWidth ?? Infinity) &&
    window.height >= (query.minHeight ?? 0) &&
    window.height <= (query.maxHeight ?? Infinity)
  );
}

/** `useMediaQuery({ maxHeight: 700 })` is true while the window matches, and re-renders when that changes. */
export function useMediaQuery(query: MediaQuery): boolean {
  const { width, height } = useWindowDimensions();
  return matchesMedia(query, { width, height });
}

/**
 * Shrinks a design size in proportion to how much smaller the window is than
 * the design, never below `floor` of it and never up: big phones keep the
 * designed size.
 */
export function scaleDown(size: number, actual: number, designed: number, floor = 0.85): number {
  return Math.round(size * Math.min(1, Math.max(floor, actual / designed)));
}

/**
 * The window's size class. Use the booleans for layout switches (fewer
 * columns and tighter gaps when compact; less vertical padding when short) and
 * the scalers for art, maps and sheets. Never scale text: it already follows
 * the user's font size.
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  return {
    width,
    height,
    fontScale,
    compact: width < breakpoints.compactWidth,
    short: height < breakpoints.shortHeight,
    /** A size bound to the window's width (art widths, tiles). */
    scaleWidth: (size: number, floor?: number) => scaleDown(size, width, designSize.width, floor),
    /** A size bound to the window's height (hero art, map and sheet heights). */
    scaleHeight: (size: number, floor?: number) => scaleDown(size, height, designSize.height, floor),
  };
}

export type Responsive = ReturnType<typeof useResponsive>;
