import { useEffect, useState } from 'react';
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';

/** OpenFreeMap vector tiles: free, no API key. */
export const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron';

/** Pawsome Companion Figma tokens for the map. */
const PET_MAP = {
  land: '#FFFDF9', //     warm ivory
  green: '#E3F2E8', //    parks, grass, dog trails
  water: '#DCEAFF', //    soft pastel blue
  building: '#F4EFEA', // warm sand
  road: '#FFFFFF',
  casing: '#EFEAE2',
} as const;

type AnyLayer = LayerSpecification & {
  'source-layer'?: string;
  paint?: Record<string, unknown>;
};

const withPaint = (layer: AnyLayer, paint: Record<string, unknown>) =>
  ({ ...layer, paint: { ...layer.paint, ...paint } }) as LayerSpecification;

/**
 * Restyles Positron's cold greys into the pet-care palette. Matches on layer
 * id and source-layer (OpenMapTiles puts roads in `transportation` with
 * `highway_*` ids). Roads without a casing in Positron get one drawn under
 * them with `line-gap-width`, so white roads stay visible on ivory land.
 */
export function petCareStyle(style: StyleSpecification): StyleSpecification {
  const ids = new Set(style.layers.map((layer) => layer.id));
  const layers: LayerSpecification[] = [];

  for (const raw of style.layers) {
    const layer = raw as AnyLayer;
    const tags = `${layer.id} ${layer['source-layer'] ?? ''}`;
    const has = (...words: string[]) => words.some((word) => tags.includes(word));

    if (layer.type === 'background') {
      layers.push(withPaint(layer, { 'background-color': PET_MAP.land }));
    } else if (layer.type === 'fill' && has('park', 'grass', 'wood', 'landcover')) {
      layers.push(withPaint(layer, { 'fill-color': PET_MAP.green }));
    } else if (has('water')) {
      if (layer.type === 'fill') layers.push(withPaint(layer, { 'fill-color': PET_MAP.water }));
      else if (layer.type === 'line') layers.push(withPaint(layer, { 'line-color': PET_MAP.water }));
      else layers.push(layer);
    } else if (layer.type === 'fill' && has('building')) {
      layers.push(
        withPaint(layer, {
          'fill-color': PET_MAP.building,
          'fill-opacity': 0.6,
          'fill-outline-color': PET_MAP.casing,
        })
      );
    } else if (layer.type === 'fill' && has('landuse_residential')) {
      // Positron greys out residential blocks; keep the whole map warm.
      layers.push(withPaint(layer, { 'fill-color': PET_MAP.land }));
    } else if (layer.type === 'line' && has('road', 'highway', 'transportation') && !has('rail')) {
      if (has('casing')) {
        layers.push(withPaint(layer, { 'line-color': PET_MAP.casing }));
        continue;
      }
      // highway_major_inner pairs with highway_major_casing; highway_minor has none.
      const casingId = `${layer.id.replace(/_(inner|subtle)$/, '')}_casing`;
      if (!ids.has(casingId) && !has('subtle', 'pier')) {
        layers.push({
          ...layer,
          id: `${layer.id}_pet_casing`,
          paint: {
            'line-color': PET_MAP.casing,
            'line-width': 1.2,
            'line-gap-width': layer.paint?.['line-width'] ?? 1,
          },
        } as LayerSpecification);
      }
      layers.push(withPaint(layer, { 'line-color': PET_MAP.road }));
    } else {
      layers.push(layer);
    }
  }

  return { ...style, layers };
}

let cached: StyleSpecification | null = null;
let pending: Promise<StyleSpecification | null> | null = null;

/** Fetches and restyles Positron once per session (call early to warm it up). */
export function loadPetCareStyle(): Promise<StyleSpecification | null> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch(OPENFREEMAP_POSITRON)
    .then((response) => (response.ok ? (response.json() as Promise<StyleSpecification>) : null))
    .then((style) => {
      cached = style ? petCareStyle(style) : null;
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * The restyled map style; null while it loads. If OpenFreeMap can't be
 * reached for the JSON, falls back to its URL so the map still renders.
 */
export function usePetCareStyle(): StyleSpecification | string | null {
  const [style, setStyle] = useState<StyleSpecification | string | null>(cached);

  useEffect(() => {
    if (cached) return undefined;
    let live = true;
    loadPetCareStyle().then((loaded) => {
      if (live) setStyle(loaded ?? OPENFREEMAP_POSITRON);
    });
    return () => {
      live = false;
    };
  }, []);

  return style;
}
