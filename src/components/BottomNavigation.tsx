import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from './Icon';

export type TabKey = 'home' | 'health' | 'routines' | 'profile';

interface BottomNavigationProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onTabChange,
}) => {
  const tabs = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'health', label: 'Health', icon: 'favorite' },
    { key: 'routines', label: 'Routines', icon: 'event-available' },
    { key: 'profile', label: 'Profile', icon: 'account-circle' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.7}
            onPress={() => onTabChange(tab.key as TabKey)}
            style={styles.tabButton}
          >
            <Icon
              name={tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.tabLabelActive : styles.tabLabelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surfaceBright,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
    paddingBottom: 8,
    shadowColor: '#181a20',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 48,
    gap: 4,
  },
  tabLabel: {
    ...typography.labelMd,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
});
