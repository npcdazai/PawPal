import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { FormField } from '../components/FormField';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { Toast, useToast } from '../components/Toast';
import { MascotAnchor, MascotScrollView } from '../mascot/MascotAnchor';
import { useMascotActions, useMascotStatus } from '../mascot/MascotProvider';
import type { ViewHandle } from '../mascot/MascotMachine';
import type { MascotState } from '../mascot/mascotModel';
import { useAppNavigation } from '../navigation/useAppNavigation';

const MASCOT_SIZE = 168;
/** The card rises over the header so its top edge meets Barnaby's paws. */
const CARD_OVERLAP = 44;
const HEADER_BOTTOM_PAD = 26;

const STATUS_COPY: Partial<Record<MascotState, string>> = {
  STATE_ENTER_FROM_RIGHT: 'Barnaby is trotting over',
  STATE_ENTER_FROM_LEFT: 'Barnaby is trotting over',
  STATE_CURIOUS_TILT: 'Barnaby is curious',
  STATE_PEEKING_DUCK: 'Barnaby is not peeking',
  STATE_WOOF_BARK: 'Barnaby says woof',
  STATE_EXIT_TO_LEFT: 'Barnaby is zooming ahead',
  STATE_EXIT_TO_RIGHT: 'Barnaby is zooming ahead',
};

export function LoginScreen() {
  const { go } = useAppNavigation();
  const { focusField, blurField } = useMascotActions();
  const { state } = useMascotStatus();
  const { message, show } = useToast();
  const cardRef = useRef<ViewHandle>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const enterDashboard = () => go('authenticated');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MascotScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Badge
            label={STATUS_COPY[state] ?? 'Barnaby is watching happily'}
            tone="white"
            dot
            uppercase
            style={styles.statusPill}
          />
          <MascotAnchor id="login" size={MASCOT_SIZE} clipRef={cardRef} />
        </View>

        <View ref={cardRef} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.subtitle}>
              {"Sign in to sync Barnaby's wellness log and daily routines."}
            </Text>
          </View>

          <FormField
            label="Email Address"
            icon="mail"
            placeholder="alex@companions.pet"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            accessory={<Badge label="PawID Ready" tone="primary" />}
            onFocus={() => focusField('text')}
            onBlur={blurField}
          />

          <FormField
            label="Password"
            icon="lock"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={enterDashboard}
            accessory={
              <Pressable
                onPress={() => show('Reset link sent to your inbox 📬')}
                accessibilityRole="link"
                hitSlop={8}
              >
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            }
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

          <Pressable
            onPress={() => setKeepLoggedIn((value) => !value)}
            role="checkbox"
            aria-checked={keepLoggedIn}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, keepLoggedIn && styles.checkboxOn]}>
              {keepLoggedIn ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>Keep me logged in for 30 days</Text>
          </Pressable>

          <PrimaryButton label="Log in" onPress={enterDashboard} />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.ssoRow}>
            <SecondaryButton label="🐾 PawPass ID" tone="blue" onPress={enterDashboard} />
            <SecondaryButton label="🔑 Passkey" tone="peach" onPress={enterDashboard} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New companion parent? </Text>
            <Pressable
              onPress={() => go('register')}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={styles.footerLink}>Register now</Text>
            </Pressable>
          </View>
        </View>
      </MascotScrollView>
      <Toast message={message} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.stage,
  },
  scroll: {
    backgroundColor: colors.canvas,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 14,
    paddingBottom: HEADER_BOTTOM_PAD,
    backgroundColor: colors.stage,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  statusPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows.soft,
  },
  card: {
    marginTop: -CARD_OVERLAP,
    marginHorizontal: 16,
    padding: 22,
    gap: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardHeader: {
    gap: 4,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.body,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.ink,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: {
    ...typography.bodySm,
    color: colors.placeholder,
  },
  ssoRow: {
    flexDirection: 'row',
    gap: 12,
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
