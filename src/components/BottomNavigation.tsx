import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts } from '../theme/typography';
import { Icon } from './Icon';

/** Height of the floating bar, for content padding underneath it. */
export const BOTTOM_NAV_HEIGHT = 64;

interface BottomNavigationTab<K extends string> {
  key: K;
  label: string;
  icon: string;
}

interface BottomNavigationProps<K extends string> {
  tabs: readonly BottomNavigationTab<K>[];
  current: K;
  onChange: (tab: K) => void;
}

/** Floating rounded tab bar; the active tab expands into a Primary Blue pill. */
export function BottomNavigation<K extends string>({
  tabs,
  current,
  onChange,
}: BottomNavigationProps<K>) {
  const insets = useSafeAreaInsets();

  return (
    <View
      role="tablist"
      style={[styles.bar, { bottom: Math.max(insets.bottom, 12) }]}
    >
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            role="tab"
            aria-selected={active}
            aria-label={tab.label}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Icon name={tab.icon} size={22} color={active ? colors.onPrimary : colors.slate} />
            {active ? (
              <Text style={styles.activeLabel}>{tab.label}</Text>
            ) : (
              <Text style={styles.label}>{tab.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.float,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.full,
  },
  tabActive: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    color: colors.slate,
  },
  activeLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.onPrimary,
  },
});
