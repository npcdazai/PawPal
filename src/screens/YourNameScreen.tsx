import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/Button';
import { PawsomeGradientScreen } from '../components/PawsomeGradientScreen';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { updateMe } from '../api/account';
import { errorMessage } from '../api/errors';
import { queryKeys } from '../api/queries';
import type { Me } from '../api/types';
import { useAuth } from '../auth/AuthProvider';

/** PATCH /me accepts 1–80 characters. */
const MAX_NAME_LENGTH = 80;

/**
 * A new account's first screen: phone sign-in creates it without a name, and
 * this is the name walkers see. Saving it updates `me`, and the route guard
 * moves on to the dashboard.
 */
export function YourNameScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { focusField, blurField } = useMascotActions();
  const [name, setName] = useState('');

  const {
    mutate: saveName,
    isPending: saving,
    error: saveError,
  } = useMutation({
    mutationFn: (next: string) => updateMe({ name: next }),
    onSuccess: (user) => {
      queryClient.setQueryData<Me>(queryKeys.me, (current) =>
        current ? { ...current, user } : { user, app: 'customer', partner: null }
      );
    },
  });
  const { mutate: leave, isPending: leaving } = useMutation({ mutationFn: signOut });

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && !saving;

  const submit = () => {
    if (ready) saveName(trimmed);
  };

  return (
    <PawsomeGradientScreen variant="CROWN">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stage}>
          <MascotDockSlot variant="auth-header" />
        </View>

        <View style={styles.card}>
          <View style={styles.formHeader}>
            <Text style={styles.title} role="heading">
              Nice to meet you!
            </Text>
            <Text style={styles.subtitle}>What should your walker call you?</Text>
          </View>

          <FormField
            label="Your Name"
            icon="person"
            placeholder="e.g. Maya Lin"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            maxLength={MAX_NAME_LENGTH}
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!saving}
            complete={trimmed.length > 0}
            onFocus={() => focusField('text')}
            onBlur={blurField}
          />

          {saveError ? (
            <View style={styles.error} role="alert" accessibilityLiveRegion="polite">
              <Icon name="error-outline" size={18} color={colors.coralInk} />
              <Text style={styles.errorText}>{errorMessage(saveError)}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={saving ? 'Saving…' : 'Continue'}
            trailingIcon={saving ? null : 'arrow-forward'}
            onPress={submit}
            disabled={!ready}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Wrong number? </Text>
            <Pressable
              onPress={() => leave()}
              disabled={leaving}
              accessibilityRole="button"
              accessibilityState={{ disabled: leaving }}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>{leaving ? 'Signing out…' : 'Sign out'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </PawsomeGradientScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  // Barnaby's stage sits straight on the CROWN glow: no panel around his slot.
  stage: {
    alignItems: 'center',
    paddingTop: 8,
  },
  // Inputs keep crisp contrast on a white card.
  card: {
    gap: 18,
    padding: 22,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  formHeader: {
    gap: 4,
    paddingHorizontal: 4,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.body,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.coralTint,
  },
  errorText: {
    ...typography.bodySm,
    flex: 1,
    color: colors.coralInk,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    ...typography.body,
  },
  footerLink: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
});
