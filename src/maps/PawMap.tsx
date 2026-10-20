import React, { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { lineFeature } from '../booking/geo';
import { colors } from '../theme/colors';
import { usePetCareStyle } from './petCareStyle';
import type { MapLineProps, MapMarkerProps, PawMapProps } from './types';

/**
 * MapLibre Native map (Android / iOS) with the pet-care OpenFreeMap style.
 * The web build uses PawMap.web.tsx (MapLibre GL JS) behind the same API.
 */
export function PawMap({
  ref,
  initialCenter,
  initialZoom = 16,
  initialBounds,
  interactive = true,
  onCameraChange,
  onCameraIdle,
  style,
  children,
}: PawMapProps) {
  const mapStyle = usePetCareStyle();
  const camera = useRef<CameraRef>(null);
  const [initialViewState] = useState(() =>
    initialBounds
      ? { bounds: initialBounds.bounds, padding: initialBounds.padding }
      : { center: initialCenter, zoom: initialZoom }
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (center, zoom, duration = 900) => camera.current?.flyTo({ center, zoom, duration }),
      fitBounds: (bounds, padding, duration = 600) => camera.current?.fitBounds(bounds, { padding, duration }),
    }),
    []
  );

  // Ivory until the restyled style JSON is ready, so the map never flashes grey.
  if (!mapStyle) return <View style={[styles.map, styles.loading, style]} />;

  return (
    <Map
      style={[styles.map, style]}
      mapStyle={mapStyle}
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      doubleTapHoldZoom={interactive}
      touchRotate={false}
      touchPitch={false}
      compass={false}
      logo={false}
      tintColor={colors.slate}
      attributionPosition={{ bottom: 6, right: 6 }}
      onRegionIsChanging={
        onCameraChange &&
        ((event) => onCameraChange(event.nativeEvent.center, event.nativeEvent.userInteraction))
      }
      onRegionDidChange={
        onCameraIdle && ((event) => onCameraIdle(event.nativeEvent.center, event.nativeEvent.userInteraction))
      }
    >
      <Camera ref={camera} initialViewState={initialViewState} />
      {children}
    </Map>
  );
}

export function MapMarker({ lngLat, anchor = 'bottom', offset, children }: MapMarkerProps) {
  return (
    <Marker lngLat={lngLat} anchor={anchor} offset={offset}>
      {children}
    </Marker>
  );
}

export function MapLine({ id, coords, color, width, dash, opacity = 1 }: MapLineProps) {
  const data = useMemo(() => lineFeature(coords), [coords]);
  return (
    <GeoJSONSource id={`${id}-source`} data={data}>
      <Layer
        id={id}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
          ...(dash ? { 'line-dasharray': [...dash] } : null),
        }}
      />
    </GeoJSONSource>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  loading: {
    backgroundColor: '#FFFDF9',
  },
});
