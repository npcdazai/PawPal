import React, { type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors, radii, shadows } from '../theme/colors';
import { fonts } from '../theme/typography';
import { MAP_SIZE } from './pickupPlaces';

const GROUND = '#F1F0EB';
const PARK = '#CFEEDC';
const PARK_EDGE = '#B7E4C9';
const WATER = '#CFE3FA';
const ROAD = '#FFFFFF';
const ROAD_EDGE = '#E6E4DE';
const LANE = '#E2E5EA';

const MAJOR_X = [180, 430, 660, 980];
const MAJOR_Y = [210, 470, 650, 830];
const MINOR_X = [70, 300, 545, 810, 1060];
const MINOR_Y = [90, 350, 560, 740, 1040];

interface NeighborhoodMapProps {
  /** Map offset so the chosen place sits under the fixed centre pin. */
  pan: Animated.ValueXY;
  /** Nearby-walker chips (pickup selection); off while tracking a walk. */
  showWalkers?: boolean;
  /** Overlays in map units (routes, pins) that pan with the map. */
  children?: ReactNode;
}

/**
 * Illustrated neighbourhood: mint parks, a river, a road grid and nearby
 * walkers, drawn in map units and panned under the fixed pickup pin.
 */
export function NeighborhoodMap({ pan, showWalkers = true, children }: NeighborhoodMapProps) {
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.map, { transform: pan.getTranslateTransform() }]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={MAP_SIZE.width} height={MAP_SIZE.height}>
          <Rect x={0} y={0} width={MAP_SIZE.width} height={MAP_SIZE.height} fill={GROUND} />

          {/* Parks */}
          <Rect x={590} y={130} width={360} height={300} rx={70} fill={PARK} stroke={PARK_EDGE} strokeWidth={4} />
          <Rect x={250} y={260} width={150} height={180} rx={40} fill={PARK} stroke={PARK_EDGE} strokeWidth={4} />
          <Rect x={700} y={690} width={240} height={110} rx={36} fill={PARK} stroke={PARK_EDGE} strokeWidth={4} />
          <Circle cx={720} cy={250} r={34} fill={WATER} />

          {/* River & dog-run pond */}
          <Path
            d="M -40 900 C 200 860, 330 1010, 560 960 S 900 880, 1140 940"
            stroke={WATER}
            strokeWidth={110}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={150} cy={960} r={70} fill={WATER} />

          {/* Minor streets */}
          {MINOR_X.map((x) => (
            <Line key={`mx${x}`} x1={x} y1={0} x2={x} y2={MAP_SIZE.height} stroke={ROAD} strokeWidth={12} />
          ))}
          {MINOR_Y.map((y) => (
            <Line key={`my${y}`} x1={0} y1={y} x2={MAP_SIZE.width} y2={y} stroke={ROAD} strokeWidth={12} />
          ))}

          {/* Avenues with lane markings */}
          {MAJOR_X.map((x) => (
            <React.Fragment key={`ax${x}`}>
              <Line x1={x} y1={0} x2={x} y2={MAP_SIZE.height} stroke={ROAD_EDGE} strokeWidth={30} />
              <Line x1={x} y1={0} x2={x} y2={MAP_SIZE.height} stroke={ROAD} strokeWidth={26} />
              <Line
                x1={x}
                y1={0}
                x2={x}
                y2={MAP_SIZE.height}
                stroke={LANE}
                strokeWidth={2}
                strokeDasharray="14 12"
              />
            </React.Fragment>
          ))}
          {MAJOR_Y.map((y) => (
            <React.Fragment key={`ay${y}`}>
              <Line x1={0} y1={y} x2={MAP_SIZE.width} y2={y} stroke={ROAD_EDGE} strokeWidth={30} />
              <Line x1={0} y1={y} x2={MAP_SIZE.width} y2={y} stroke={ROAD} strokeWidth={26} />
              <Line
                x1={0}
                y1={y}
                x2={MAP_SIZE.width}
                y2={y}
                stroke={LANE}
                strokeWidth={2}
                strokeDasharray="14 12"
              />
            </React.Fragment>
          ))}

          {/* Diagonal boulevard */}
          <Line x1={0} y1={600} x2={MAP_SIZE.width} y2={380} stroke={ROAD_EDGE} strokeWidth={26} />
          <Line x1={0} y1={600} x2={MAP_SIZE.width} y2={380} stroke={ROAD} strokeWidth={22} />

          {/* City blocks */}
          {[
            [470, 500, 160, 120],
            [200, 490, 200, 130],
            [470, 680, 160, 120],
            [200, 670, 200, 130],
            [690, 500, 260, 120],
            [200, 240, 40, 200],
          ].map(([x, y, w, h]) => (
            <Rect key={`b${x}-${y}`} x={x + 14} y={y + 14} width={w - 28} height={h - 28} rx={14} fill="#E9E7E1" />
          ))}
        </Svg>

        <MapLabel x={770} y={185} label="ELM CREEK PARK" />
        <MapLabel x={300} y={1010} label="RIVERSIDE" />

        {showWalkers ? (
          <>
            <WalkerChip x={410} y={400} initial="M" name="Marcus T." detail="4 min away" tint={colors.primary} />
            <WalkerChip x={690} y={560} initial="E" name="Elena R." detail="★ 4.9 • 6 min" tint={colors.coral} />
            <WalkerChip x={210} y={700} initial="D" name="David K." detail="★ 4.8 • 9 min" tint={colors.amber} />
          </>
        ) : null}
      </View>
      {children}
    </Animated.View>
  );
}

function MapLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <View style={[styles.label, { left: x - 70, top: y - 14 }]}>
      <View style={styles.labelDot} />
      <Text style={styles.labelText}>{label}</Text>
    </View>
  );
}

function WalkerChip({
  x,
  y,
  initial,
  name,
  detail,
  tint,
}: {
  x: number;
  y: number;
  initial: string;
  name: string;
  detail: string;
  tint: string;
}) {
  return (
    <View style={[styles.walker, { left: x, top: y }]}>
      <View style={[styles.walkerAvatar, { backgroundColor: tint }]}>
        <Text style={styles.walkerInitial}>{initial}</Text>
      </View>
      <View>
        <Text style={styles.walkerName}>{name}</Text>
        <Text style={[styles.walkerDetail, { color: tint === colors.amber ? colors.amberInk : tint }]}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MAP_SIZE.width,
    height: MAP_SIZE.height,
  },
  label: {
    position: 'absolute',
    width: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  labelDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  labelText: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.successInk,
  },
  walker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  walkerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerInitial: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  walkerName: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  walkerDetail: {
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
});
