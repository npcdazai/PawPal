import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { MascotRef, MascotSprite } from '../components/MascotSprite';
import { Toast } from '../components/Toast';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onNavigateRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onNavigateRegister,
}) => {
  const mascotRef = useRef<MascotRef>(null);

  const [email, setEmail] = useState('alex@companions.pet');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginCompleted, setLoginCompleted] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const handleLogin = () => {
    if (isSubmitting || loginCompleted) return;
    setIsSubmitting(true);

    // Trigger excited sprint-off
    if (mascotRef.current) {
      mascotRef.current.sprintOff();
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setLoginCompleted(true);
      showToast('Connected to Barnaby! 🐾');

      setTimeout(() => {
        onLoginSuccess();
      }, 700);
    }, 1100);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Toast visible={toastVisible} message={toastMessage} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Mascot Stage */}
        <View style={styles.mascotStage}>
          {/* Status Pill */}
          <View style={styles.statusPill}>
            <View style={styles.pulsingDot} />
            <Text style={styles.statusPillText}>Barnaby is waiting for you!</Text>
            <Text style={{ fontSize: 12 }}>🐾</Text>
          </View>

          {/* Interactive Mascot */}
          <View style={styles.mascotWrapper}>
            <MascotSprite
              ref={mascotRef}
              size={170}
              initialMessage="Woof! 🐾"
              onTap={() => showToast('Woof! Barnaby loves you! 🐾')}
            />
            {/* Tactile Ground Shadow */}
            <View style={styles.groundShadow} />
          </View>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>
              {"Sign in to sync your pet's wellness log and daily routines."}
            </Text>
          </View>

          {/* Email Field Group */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>Email or Pet Parent ID</Text>
              <View style={styles.pawIdBadge}>
                <Text style={styles.pawIdText}>PawID Ready</Text>
              </View>
            </View>
            <View
              style={[
                styles.inputContainer,
                emailFocused && styles.inputContainerFocused,
              ]}
            >
              <Icon
                name="mail"
                size={20}
                color={emailFocused ? colors.primary : colors.outline}
                style={styles.inputIconLeft}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="alex@companions.pet"
                placeholderTextColor={`${colors.outline}B0`}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => {
                  setEmailFocused(true);
                  mascotRef.current?.onFocusInput('text');
                }}
                onBlur={() => {
                  setEmailFocused(false);
                  mascotRef.current?.onBlurInput();
                }}
              />
            </View>
          </View>

          {/* Password Field Group */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>Security Password</Text>
              <TouchableOpacity
                onPress={() => showToast('Password reset link sent to registered email!')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.inputContainer,
                passwordFocused && styles.inputContainerFocused,
              ]}
            >
              <Icon
                name="lock"
                size={20}
                color={passwordFocused ? colors.primary : colors.outline}
                style={styles.inputIconLeft}
              />
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor={`${colors.outline}B0`}
                secureTextEntry={!showPassword}
                onFocus={() => {
                  setPasswordFocused(true);
                  mascotRef.current?.onFocusInput('password');
                }}
                onBlur={() => {
                  setPasswordFocused(false);
                  mascotRef.current?.onBlurInput();
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Icon
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={colors.outline}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Keep Logged In Checkbox */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setKeepLoggedIn(!keepLoggedIn)}
            style={styles.checkboxRow}
          >
            <View
              style={[
                styles.checkboxBox,
                keepLoggedIn && styles.checkboxBoxChecked,
              ]}
            >
              {keepLoggedIn && <Icon name="check" size={16} color="#ffffff" />}
            </View>
            <Text style={styles.checkboxLabel}>Keep me logged in for 30 days</Text>
          </TouchableOpacity>

          {/* Primary Action CTA */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={isSubmitting || loginCompleted}
            style={[
              styles.submitButton,
              loginCompleted && { backgroundColor: '#10B981' },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : loginCompleted ? (
              <View style={styles.submitRow}>
                <Icon name="done" size={20} color={colors.onPrimary} />
                <Text style={styles.submitText}>Connected!</Text>
              </View>
            ) : (
              <View style={styles.submitRow}>
                <Text style={styles.submitText}>Log In</Text>
                <Icon name="arrow-forward" size={18} color={colors.onPrimary} />
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Quick Access Grid */}
          <View style={styles.socialGrid}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                showToast('PawPass biometric verification active');
                handleLogin();
              }}
              style={styles.socialButtonPrimary}
            >
              <Icon name="pets" size={18} color={colors.primary} />
              <Text style={styles.socialPrimaryText}>PawPass ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                showToast('Passkey verified successfully');
                handleLogin();
              }}
              style={styles.socialButtonTertiary}
            >
              <Icon name="key" size={18} color={colors.tertiary} />
              <Text style={styles.socialTertiaryText}>Passkey</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Register Link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>New pet parent? </Text>
            <TouchableOpacity onPress={onNavigateRegister}>
              <Text style={styles.registerLink}>Register now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footnote */}
        <View style={styles.footnoteRow}>
          <Icon name="verified-user" size={16} color={colors.outline} />
          <Text style={styles.footnoteText}>End-to-End Encrypted Health Records</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  mascotStage: {
    width: '100%',
    backgroundColor: colors.onTertiaryContainer,
    borderRadius: radii.lg,
    paddingTop: 20,
    paddingBottom: 36,
    alignItems: 'center',
    position: 'relative',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    marginBottom: 8,
    ...shadows.card,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryContainer,
  },
  statusPillText: {
    ...typography.labelSm,
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  mascotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  groundShadow: {
    position: 'absolute',
    bottom: -6,
    width: 110,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: 'rgba(41, 24, 0, 0.08)',
  },
  formCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: 20,
    marginTop: -24,
    zIndex: 10,
    ...shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    ...typography.headlineLg,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.outline,
    textAlign: 'center',
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  pawIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
  },
  pawIdText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
  },
  forgotPasswordText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  inputContainer: {
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerLow,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.primary,
    ...shadows.cardHover,
  },
  inputIconLeft: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowPrimary,
    marginTop: 4,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    ...typography.labelLg,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
  },
  dividerText: {
    ...typography.labelSm,
    color: colors.outline,
    paddingHorizontal: 12,
    letterSpacing: 0.8,
  },
  socialGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButtonPrimary: {
    flex: 1,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: 'rgba(220, 225, 255, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialPrimaryText: {
    ...typography.labelMd,
    color: colors.onPrimaryFixed,
    fontWeight: '600',
  },
  socialButtonTertiary: {
    flex: 1,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 221, 180, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialTertiaryText: {
    ...typography.labelMd,
    color: colors.onTertiaryFixed,
    fontWeight: '600',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  registerPrompt: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  registerLink: {
    ...typography.labelLg,
    color: colors.primary,
    fontWeight: '700',
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  footnoteText: {
    ...typography.labelSm,
    color: colors.outline,
  },
});
