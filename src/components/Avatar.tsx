import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '../theme/typography';

interface AvatarProps {
  initials: string;
  tint: string;
  ink: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Initials avatar used for people (no remote photos needed). */
export function Avatar({ initials, tint, ink, size = 44, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
        style,
      ]}
    >
      <Text style={[styles.text, { color: ink, fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.extrabold,
  },
});
