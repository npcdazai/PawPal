import type { ReactElement, ReactNode, Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { LngLat } from '../booking/geo';

/** [west, south, east, north] */
export type MapBounds = [west: number, south: number, east: number, north: number];

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarkerAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface PawMapHandle {
  flyTo: (center: LngLat, zoom?: number, duration?: number) => void;
  fitBounds: (bounds: MapBounds, padding: MapPadding, duration?: number) => void;
}

/** One API over MapLibre Native (PawMap.tsx) and MapLibre GL JS (PawMap.web.tsx). */
export interface PawMapProps {
  ref?: Ref<PawMapHandle>;
  initialCenter: LngLat;
  initialZoom?: number;
  /** Frame these bounds instead of centre/zoom (e.g. a whole route). */
  initialBounds?: { bounds: MapBounds; padding: MapPadding };
  /** Pan and pinch-zoom (rotation and pitch stay off so north is always up). */
  interactive?: boolean;
  /** Every camera frame; `byUser` is true for drags and pinches. */
  onCameraChange?: (center: LngLat, byUser: boolean) => void;
  /** Camera came to rest. */
  onCameraIdle?: (center: LngLat, byUser: boolean) => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** A React view pinned to a map coordinate. */
export interface MapMarkerProps {
  lngLat: LngLat;
  anchor?: MarkerAnchor;
  /** Pixels; positive moves the view right / down. */
  offset?: [x: number, y: number];
  children: ReactElement;
}

/** A GeoJSON LineString layer. */
export interface MapLineProps {
  id: string;
  coords: readonly LngLat[];
  color: string;
  width: number;
  /** Line dash pattern, in line widths. */
  dash?: readonly number[];
  opacity?: number;
}
