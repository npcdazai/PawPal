import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { colors, radii } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { PrimaryButton } from './Button';

/**
 * Recovery screen for render errors (the root layout's ErrorBoundary). Kept
 * free of app providers, since it can replace the whole tree.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View role="alert" style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.glyph}>🐾</Text>
        </View>
        <Text role="heading" style={styles.title}>
          Ruff! Something went wrong
        </Text>
        <Text style={styles.body}>
          PawPal hit an unexpected snag. Tap Try again — if it keeps happening, close and reopen the app.
        </Text>
        {__DEV__ ? (
          <Text style={styles.detail} numberOfLines={4}>
            {error.message}
          </Text>
        ) : null}
        <PrimaryButton label="Try again" trailingIcon="refresh" onPress={() => void retry()} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: colors.stage,
  },
  glyph: {
    fontSize: 44,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  detail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.coralInk,
    textAlign: 'center',
    padding: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.coralTint,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
});
