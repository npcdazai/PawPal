import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions } from '../mascot/MascotProvider';
import { PHYSICS } from '../mascot/mascotModel';
import { useAppNavigation } from '../navigation/useAppNavigation';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const READINESS_COPY = [
  'Say hi — Barnaby is waiting to meet you',
  "Barnaby's ears just perked up!",
  'Tail is starting to wag…',
  'Almost there — zoomies incoming!',
  'Full zoomies unlocked! 🎉',
];

export function RegisterScreen() {
  const { go } = useAppNavigation();
  const { focusField, blurField, setWagFps } = useMascotActions();

  const [ownerName, setOwnerName] = useState('');
  const [petName, setPetName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const checks = {
    owner: ownerName.trim().length > 0,
    pet: petName.trim().length > 0,
    email: EMAIL_PATTERN.test(email.trim()),
    password: password.length >= 6,
  };
  const completed = Object.values(checks).filter(Boolean).length;
  const readiness = completed / 4;

  // Readiness speeds up Barnaby's tail wag from 8 fps to 18 fps.
  useEffect(() => {
    setWagFps(PHYSICS.idleFps + (PHYSICS.idleFpsMax - PHYSICS.idleFps) * readiness);
  }, [readiness, setWagFps]);
  useEffect(() => () => setWagFps(PHYSICS.idleFps), [setWagFps]);

  const createAccount = () => go('authenticated');
  const backToLogin = () => go('signIn');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stage}>
          <View style={styles.badges}>
            <Badge label="🐾 Step 1 of 4" tone="primary" uppercase />
            <Badge label="Playful Pup 🍊" tone="amber" />
          </View>

          <MascotDockSlot variant="auth-header" />

          <View style={styles.readiness}>
            <View style={styles.readinessHeader}>
              <View style={styles.readinessTitle}>
                <Icon name="auto-awesome" size={16} color={colors.primary} />
                <Text style={styles.readinessLabel}>Companion Readiness</Text>
              </View>
              <Text style={styles.readinessValue}>{Math.round(readiness * 100)}%</Text>
            </View>
            <ProgressBar progress={readiness} />
            <Text style={styles.readinessHint}>{READINESS_COPY[completed]}</Text>
          </View>
        </View>

        <View style={styles.formHeader}>
          <Text style={styles.title}>Create your nest</Text>
          <Text style={styles.subtitle}>
            {"Set up your profile and your best friend's daily care log."}
          </Text>
        </View>

        <View style={styles.form}>
          <FormField
            label="Your Name"
            icon="person"
            placeholder="e.g. Maya Lin"
            value={ownerName}
            onChangeText={setOwnerName}
            autoComplete="name"
            textContentType="name"
            complete={checks.owner}
            onFocus={() => focusField('text')}
            onBlur={blurField}
          />
          <FormField
            label="Pet's Name"
            icon="pets"
            placeholder="e.g. Biscuit, Mochi, Milo"
            value={petName}
            onChangeText={setPetName}
            autoCapitalize="words"
            complete={checks.pet}
            onFocus={() => focusField('text')}
            onBlur={blurField}
          />
          <FormField
            label="Email Address"
            icon="mail"
            placeholder="maya@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            complete={checks.email}
            onFocus={() => focusField('text')}
            onBlur={blurField}
          />
          <FormField
            label="Create Password"
            icon="lock"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            complete={checks.password}
            trailing={
              <Pressable
                onPress={() => setShowPassword((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={10}
              >
                <Icon
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={colors.slate}
                />
              </Pressable>
            }
            onFocus={() => focusField('password')}
            onBlur={blurField}
          />
        </View>

        <PrimaryButton label="Create Account" onPress={createAccount} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have a companion account? </Text>
          <Pressable onPress={backToLogin} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  stage: {
    alignItems: 'center',
    padding: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.stage,
  },
  badges: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readiness: {
    alignSelf: 'stretch',
    marginTop: 10,
    padding: 14,
    gap: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  readinessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readinessTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readinessLabel: {
    ...typography.label,
  },
  readinessValue: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    color: colors.primary,
  },
  readinessHint: {
    ...typography.bodySm,
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
  form: {
    gap: 14,
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
