import { Animated } from 'react-native';

/** A native-driven x/y offset (e.g. a pin travelling along a route). */
export interface RouteOffset {
  x: Animated.AnimatedInterpolation<number>;
  y: Animated.AnimatedInterpolation<number>;
}

export interface Point {
  x: number;
  y: number;
}

/** A polyline in map units with each vertex's share of the total length. */
export interface Route {
  points: readonly Point[];
  /** Cumulative distance fraction (0 → 1) at each vertex. */
  fractions: readonly number[];
}

export function makeRoute(points: readonly Point[]): Route {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  const total = lengths[lengths.length - 1] || 1;
  return { points, fractions: lengths.map((length) => length / total) };
}

/** Position at fraction `t` (0–1) along the route. */
export function pointAt(route: Route, t: number): Point {
  const clamped = Math.max(0, Math.min(1, t));
  const { points, fractions } = route;
  for (let i = 1; i < points.length; i += 1) {
    if (clamped <= fractions[i]) {
      const span = fractions[i] - fractions[i - 1] || 1;
      const local = (clamped - fractions[i - 1]) / span;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * local,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * local,
      };
    }
  }
  return points[points.length - 1];
}

/** The walked part and the remaining part of the route at fraction `t`. */
export function splitRoute(route: Route, t: number): { done: Point[]; rest: Point[] } {
  const here = pointAt(route, t);
  const done: Point[] = [];
  const rest: Point[] = [here];
  route.points.forEach((point, index) => {
    if (route.fractions[index] < t) done.push(point);
    else rest.push(point);
  });
  done.push(here);
  return { done, rest };
}

export const toSvgPath = (points: readonly Point[]) =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

/**
 * Native-driven offset from the route's start that follows `progress` (0–1)
 * along the polyline — moves a pin (and Barnaby's slot inside it) smoothly.
 */
export function routeOffset(route: Route, progress: Animated.Value): RouteOffset {
  const origin = route.points[0];
  // Interpolation needs strictly increasing input; nudge any zero-length segments.
  const inputRange = route.fractions.map((fraction, index) => fraction + index * 1e-6);
  return {
    x: progress.interpolate({
      inputRange,
      outputRange: route.points.map((point) => point.x - origin.x),
      extrapolate: 'clamp',
    }),
    y: progress.interpolate({
      inputRange,
      outputRange: route.points.map((point) => point.y - origin.y),
      extrapolate: 'clamp',
    }),
  };
}

/** Centre of the route's bounding box, for framing the map. */
export function routeCenter(points: readonly Point[]): Point {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** The walker's way to the Home pickup along the streets (framed to fit a phone-width map). */
export const PICKUP_ROUTE = makeRoute([
  { x: 300, y: 350 },
  { x: 430, y: 350 },
  { x: 430, y: 470 },
  { x: 545, y: 470 },
  { x: 545, y: 560 },
  { x: 520, y: 560 },
]);

/** Home → Elm Creek Park meadow loop → back home along a quieter street. */
export const PARK_LOOP = makeRoute([
  { x: 520, y: 560 },
  { x: 545, y: 560 },
  { x: 545, y: 470 },
  { x: 660, y: 470 },
  { x: 660, y: 420 },
  { x: 690, y: 370 },
  { x: 735, y: 345 },
  { x: 770, y: 372 },
  { x: 762, y: 420 },
  { x: 730, y: 452 },
  { x: 700, y: 520 },
  { x: 660, y: 560 },
  { x: 545, y: 560 },
  { x: 520, y: 560 },
]);

/** Map framing for the live walk: a touch right of centre so labels clear both edges. */
export const PARK_LOOP_FOCUS: Point = { x: 655, y: 462 };
