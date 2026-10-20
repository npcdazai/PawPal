import React, {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLibreEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { lineFeature, type LngLat } from '../booking/geo';
import type { ViewHandle } from '../theme/motion';
import { usePetCareStyle } from './petCareStyle';
import type { MapLineProps, MapMarkerProps, PawMapProps } from './types';

// MapLibre finds its worker via import.meta.url, which Metro's bundle lacks;
// scripts/copy-maplibre-worker.mjs puts a copy in public/ on install.
setWorkerUrl('/maplibre-gl-worker.mjs');

const MapContext = createContext<MapLibreMap | null>(null);

/**
 * MapLibre GL JS map for the web build, behind the same API as the native
 * PawMap. Markers render React content into MapLibre marker elements through
 * portals, so context (Barnaby's slot, navigation focus) still reaches them.
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
  const containerRef = useRef<ViewHandle>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [initial] = useState(() => ({ initialCenter, initialZoom, initialBounds, interactive }));
  const callbacks = useRef({ onCameraChange, onCameraIdle });

  useEffect(() => {
    callbacks.current = { onCameraChange, onCameraIdle };
  });

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!mapStyle || !container) return undefined;

    const instance = new MapLibreMap({
      container,
      style: mapStyle as string | StyleSpecification,
      center: initial.initialCenter,
      zoom: initial.initialZoom,
      interactive: initial.interactive,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    instance.touchZoomRotate.disableRotation();
    if (initial.initialBounds) {
      instance.fitBounds(initial.initialBounds.bounds, {
        padding: initial.initialBounds.padding,
        duration: 0,
      });
    }

    let byUser = false;
    const centerOf = (): LngLat => {
      const { lng, lat } = instance.getCenter();
      return [lng, lat];
    };
    // Camera moves started by a drag or pinch carry the DOM event that caused them.
    instance.on('movestart', (event: MapLibreEvent<unknown>) => {
      byUser = Boolean(event.originalEvent);
    });
    instance.on('move', () => callbacks.current.onCameraChange?.(centerOf(), byUser));
    instance.on('moveend', () => callbacks.current.onCameraIdle?.(centerOf(), byUser));
    instance.on('load', () => setMap(instance));
    mapRef.current = instance;

    return () => {
      mapRef.current = null;
      setMap(null);
      instance.remove();
    };
  }, [mapStyle, initial]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (center, zoom, duration = 900) =>
        mapRef.current?.flyTo({ center, zoom: zoom ?? mapRef.current.getZoom(), duration }),
      fitBounds: (bounds, padding, duration = 600) => mapRef.current?.fitBounds(bounds, { padding, duration }),
    }),
    []
  );

  return (
    <View style={[styles.map, style]}>
      {/* Sized by flex: MapLibre's CSS forces `position: relative` on its container. */}
      <View ref={containerRef} style={styles.container} />
      {map ? <MapContext.Provider value={map}>{children}</MapContext.Provider> : null}
    </View>
  );
}

export function MapMarker({ lngLat, anchor = 'bottom', offset, children }: MapMarkerProps) {
  const map = useContext(MapContext);
  const element = useMemo(() => document.createElement('div'), []);
  const markerRef = useRef<Marker | null>(null);
  const [lng, lat] = lngLat;
  const [offsetX, offsetY] = offset ?? [0, 0];
  const position = useRef<LngLat>(lngLat);

  useEffect(() => {
    position.current = [lng, lat];
    markerRef.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  useEffect(() => {
    if (!map) return undefined;
    const marker = new Marker({ element, anchor, offset: [offsetX, offsetY] })
      .setLngLat(position.current)
      .addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, element, anchor, offsetX, offsetY]);

  return createPortal(children, element);
}

export function MapLine({ id, coords, color, width, dash, opacity = 1 }: MapLineProps) {
  const map = useContext(MapContext);
  const data = useMemo(() => lineFeature(coords), [coords]);
  const latest = useRef(data);
  const sourceId = `${id}-source`;
  const dashKey = dash?.join(',');

  // Declared first so a re-added layer starts from the latest geometry.
  useEffect(() => {
    latest.current = data;
    (map?.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data);
  }, [map, sourceId, data]);

  useEffect(() => {
    if (!map) return undefined;
    map.addSource(sourceId, { type: 'geojson', data: latest.current });
    map.addLayer({
      id,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-width': width,
        'line-opacity': opacity,
        ...(dashKey ? { 'line-dasharray': dashKey.split(',').map(Number) } : null),
      },
    });
    return () => {
      // The map may already be torn down when the whole screen unmounts.
      try {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Nothing left to remove.
      }
    };
  }, [map, id, sourceId, color, width, opacity, dashKey]);

  return null;
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  container: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
