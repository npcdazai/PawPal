import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/Button';
import { Toast, useToast } from '../components/Toast';
import { MascotDockSlot } from '../mascot/MascotDockSlot';
import { useMascotActions, useMascotState } from '../mascot/MascotProvider';
import type { MascotState } from '../mascot/mascotModel';
import { isApiError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { cleanSmsCode, formatPhone, isSmsCode, SMS_CODE_LENGTH, toE164 } from '../auth/phoneNumber';
import {
  confirmCode,
  PhoneSignInError,
  requestCode,
  signInMethod,
  UNCONFIGURED_MESSAGE,
} from '../auth/phoneSignIn';

/** The card rises over the header's bottom padding, never over Barnaby's slot. */
const CARD_OVERLAP = 44;
const HEADER_BOTTOM_PAD = CARD_OVERLAP + 12;

const STATUS_COPY: Partial<Record<MascotState, string>> = {
  STATE_ENTER_FROM_RIGHT: 'Barnaby is trotting over',
  STATE_CURIOUS_TILT: 'Barnaby is curious',
  STATE_PEEKING_DUCK: 'Barnaby is not peeking',
  STATE_WOOF_BARK: 'Barnaby says woof',
  STATE_EXIT_TO_LEFT: 'Barnaby is zooming ahead',
};

/** Sign-in failures carry user-facing copy (ours or the API's); anything else gets a generic line. */
const failureCopy = (error: unknown) =>
  error instanceof PhoneSignInError || isApiError(error) ? error.message : 'Something went wrong. Try again.';

/**
 * Phone sign-in (APP_INTEGRATION §2): the number, then the 6-digit SMS code.
 * The first sign-in creates the account. Once the session is kept, the root
 * layout's route guard opens the app, so this screen never navigates itself.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
  const { focusField, blurField } = useMascotActions();
  const state = useMascotState();
  const { message, show } = useToast();

  const [method] = useState(signInMethod);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  /** The number the code went to (E.164); null on the phone step. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    mutate: sendCode,
    reset: resetSend,
    isPending: sending,
    error: sendError,
  } = useMutation({ mutationFn: requestCode });
  const {
    mutate: verifyCode,
    reset: resetVerify,
    isPending: verifying,
    error: verifyError,
  } = useMutation({ mutationFn: confirmCode, onSuccess: signIn });

  const unconfigured = method === 'unconfigured';
  const phoneReady = toE164(phone) !== null;
  const codeReady = isSmsCode(cleanSmsCode(code));

  const submitPhone = () => {
    if (!phoneReady || sending || unconfigured) return;
    sendCode(phone, {
      onSuccess: (e164) => {
        setSentTo(e164);
        setCode('');
        resetVerify();
      },
    });
  };

  const resend = () => {
    if (!sentTo || sending) return;
    // The latest attempt's error shows: a failed resend replaces an earlier wrong code.
    resetVerify();
    sendCode(sentTo, {
      onSuccess: () => {
        setCode('');
        resetVerify();
        show(method === 'dev' ? 'New code sent: it’s in the API console' : 'New code sent 📲');
      },
    });
  };

  const submitCode = () => {
    if (!codeReady || verifying) return;
    resetSend();
    verifyCode(code);
  };

  const changeNumber = () => {
    setSentTo(null);
    setCode('');
    resetSend();
    resetVerify();
  };

  // On the code step a failed resend shows too.
  const error = sentTo ? (verifyError ?? sendError) : sendError;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
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
          {/* Ducking for the code lowers him behind the slot's bottom edge. */}
          <MascotDockSlot variant="auth-header" />
        </View>

        <View style={styles.card}>
          {sentTo ? (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.title} role="heading">
                  Enter your code
                </Text>
                <Text style={styles.subtitle}>
                  {method === 'dev'
                    ? `Signing in ${formatPhone(sentTo)}.`
                    : `We texted a ${SMS_CODE_LENGTH}-digit code to ${formatPhone(sentTo)}.`}
                </Text>
              </View>

              <FormField
                label={`${SMS_CODE_LENGTH}-digit code`}
                icon="sms"
                placeholder="••••••"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={SMS_CODE_LENGTH}
                returnKeyType="go"
                onSubmitEditing={submitCode}
                editable={!verifying}
                accessory={
                  <Pressable onPress={changeNumber} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.link}>Change number</Text>
                  </Pressable>
                }
                onFocus={() => focusField('password')}
                onBlur={blurField}
              />

              {method === 'dev' ? (
                <Text style={styles.note}>
                  Development build: no SMS is sent. The code is printed in the API console (and Metro).
                </Text>
              ) : null}

              {error ? <ErrorLine message={failureCopy(error)} /> : null}

              <PrimaryButton
                label={verifying ? 'Signing in…' : 'Verify & Sign In'}
                trailingIcon={verifying ? null : 'arrow-forward'}
                onPress={submitCode}
                disabled={!codeReady || verifying}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>{"Didn't get it? "}</Text>
                <Pressable
                  onPress={resend}
                  disabled={sending || verifying}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: sending || verifying }}
                  hitSlop={8}
                >
                  <Text style={styles.footerLink}>{sending ? 'Sending…' : 'Send a new code'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.title} role="heading">
                  Welcome to PawPal
                </Text>
                <Text style={styles.subtitle}>
                  Sign in or create your account with your mobile number.
                </Text>
              </View>

              <FormField
                label="Mobile Number"
                icon="phone-iphone"
                placeholder="98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                returnKeyType="go"
                onSubmitEditing={submitPhone}
                editable={!sending}
                accessory={<Badge label="India +91" tone="primary" />}
                onFocus={() => focusField('text')}
                onBlur={blurField}
              />

              {unconfigured ? (
                <View style={styles.notice} role="alert">
                  <Icon name="info-outline" size={20} color={colors.amberInk} />
                  <Text style={styles.noticeText}>{UNCONFIGURED_MESSAGE} Please update the app, or try again later.</Text>
                </View>
              ) : (
                <Text style={styles.note}>
                  {method === 'dev'
                    ? 'Development build: signs in through the local API, no SMS is sent.'
                    : `We'll text you a ${SMS_CODE_LENGTH}-digit code. SMS charges may apply.`}
                </Text>
              )}

              {error ? <ErrorLine message={failureCopy(error)} /> : null}

              <PrimaryButton
                label={sending ? 'Sending code…' : 'Send Code'}
                trailingIcon={sending ? null : 'arrow-forward'}
                onPress={submitPhone}
                disabled={!phoneReady || sending || unconfigured}
              />
            </>
          )}
        </View>
      </ScrollView>
      <Toast message={message} />
    </SafeAreaView>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <View style={styles.error} role="alert" accessibilityLiveRegion="polite">
      <Icon name="error-outline" size={18} color={colors.coralInk} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
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
    paddingHorizontal: 16,
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
  note: {
    ...typography.bodySm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.amberTint,
  },
  noticeText: {
    ...typography.bodySm,
    flex: 1,
    color: colors.amberInk,
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
