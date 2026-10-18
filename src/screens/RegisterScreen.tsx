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

interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onNavigateLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onRegisterSuccess,
  onNavigateLogin,
}) => {
  const mascotRef = useRef<MascotRef>(null);

  const [ownerName, setOwnerName] = useState('');
  const [petName, setPetName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Compute profile readiness
  const filledCount = [ownerName, petName, email, password].filter(
    (val) => val.trim().length > 0
  ).length;
  const readinessPercent = Math.round((filledCount / 4) * 100);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const handleCreateAccount = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (mascotRef.current) {
      mascotRef.current.sprintOff();
    }

    setTimeout(() => {
      setIsSubmitting(false);
      showToast('Welcome to PawPal family! 🐾');
      setTimeout(() => {
        onRegisterSuccess();
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
        {/* Top Mascot Stage Card */}
        <View style={styles.mascotStageCard}>
          {/* Badges Row */}
          <View style={styles.badgesRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 1 OF 4</Text>
            </View>
            <View style={styles.petBadge}>
              <Text style={styles.petBadgeText}>Happy Pup</Text>
              <Icon name="pets" size={14} color={colors.onTertiaryFixed} />
            </View>
          </View>

          {/* Interactive Mascot */}
          <MascotSprite
            ref={mascotRef}
            size={160}
            initialMessage="Woof! Let's go! 🐾"
            onTap={() => showToast("Woof! Let's go! 🐾")}
          />

          {/* Profile Readiness Meter */}
          <View style={styles.readinessContainer}>
            <View style={styles.readinessHeader}>
              <View style={styles.readinessTitleRow}>
                <Icon name="auto-awesome" size={16} color={colors.primary} />
                <Text style={styles.readinessLabel}>Profile Readiness</Text>
              </View>
              <Text style={styles.readinessPercent}>{readinessPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${readinessPercent}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Form Body Header */}
        <View style={styles.formHeader}>
          <Text style={styles.headline}>Create your nest</Text>
          <Text style={styles.subhead}>
            {"Set up your profile and your best friend's daily care log."}
          </Text>
        </View>

        {/* Inputs */}
        <View style={styles.formInputs}>
          {/* Input 1: Caretaker Name */}
          <View
            style={[
              styles.inputBox,
              focusedField === 'owner' && styles.inputBoxFocused,
            ]}
          >
            <Icon
              name="person"
              size={22}
              color={focusedField === 'owner' ? colors.primary : colors.outline}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="e.g. Maya Lin"
              placeholderTextColor={colors.outline}
              onFocus={() => {
                setFocusedField('owner');
                mascotRef.current?.onFocusInput('text');
              }}
              onBlur={() => {
                setFocusedField(null);
                mascotRef.current?.onBlurInput();
              }}
            />
          </View>

          {/* Input 2: Pet Name */}
          <View
            style={[
              styles.inputBox,
              focusedField === 'pet' && styles.inputBoxFocused,
            ]}
          >
            <Icon
              name="pets"
              size={22}
              color={focusedField === 'pet' ? colors.primary : colors.outline}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              value={petName}
              onChangeText={setPetName}
              placeholder="e.g. Barnaby, Mochi"
              placeholderTextColor={colors.outline}
              onFocus={() => {
                setFocusedField('pet');
                mascotRef.current?.onFocusInput('text');
              }}
              onBlur={() => {
                setFocusedField(null);
                mascotRef.current?.onBlurInput();
              }}
            />
          </View>

          {/* Input 3: Email Address */}
          <View
            style={[
              styles.inputBox,
              focusedField === 'email' && styles.inputBoxFocused,
            ]}
          >
            <Icon
              name="mail"
              size={22}
              color={focusedField === 'email' ? colors.primary : colors.outline}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="alex@companions.pet"
              placeholderTextColor={colors.outline}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => {
                setFocusedField('email');
                mascotRef.current?.onFocusInput('text');
              }}
              onBlur={() => {
                setFocusedField(null);
                mascotRef.current?.onBlurInput();
              }}
            />
          </View>

          {/* Input 4: Password with Visibility Toggle */}
          <View
            style={[
              styles.inputBox,
              focusedField === 'password' && styles.inputBoxFocused,
            ]}
          >
            <Icon
              name="lock"
              size={22}
              color={focusedField === 'password' ? colors.primary : colors.outline}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { paddingRight: 44 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 gentle characters"
              placeholderTextColor={colors.outline}
              secureTextEntry={!showPassword}
              onFocus={() => {
                setFocusedField('password');
                mascotRef.current?.onFocusInput('password');
              }}
              onBlur={() => {
                setFocusedField(null);
                mascotRef.current?.onBlurInput();
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.toggleButton}
            >
              <Icon
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreateAccount}
            disabled={isSubmitting}
            style={styles.createButton}
          >
            {isSubmitting ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.createButtonText}>Off to the park...</Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <Text style={styles.createButtonText}>Create Account</Text>
                <Icon name="arrow-forward" size={20} color={colors.onPrimary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Link */}
        <View style={styles.bottomLinkContainer}>
          <Text style={styles.bottomPrompt}>Already have a companion account? </Text>
          <TouchableOpacity onPress={onNavigateLogin}>
            <Text style={styles.bottomSignIn}>Sign In</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  mascotStageCard: {
    width: '100%',
    backgroundColor: colors.peachBg,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  badgesRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
  },
  stepBadgeText: {
    ...typography.labelMd,
    color: colors.primary,
    fontWeight: '700',
  },
  petBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.tertiaryFixed,
  },
  petBadgeText: {
    ...typography.labelMd,
    color: colors.onTertiaryFixed,
    fontWeight: '600',
  },
  readinessContainer: {
    width: '100%',
    marginTop: 12,
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  readinessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readinessLabel: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  readinessPercent: {
    ...typography.headlineSm,
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.primaryContainer,
  },
  formHeader: {
    marginBottom: 16,
  },
  headline: {
    ...typography.headlineLg,
    color: colors.onSurface,
    marginBottom: 4,
  },
  subhead: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  formInputs: {
    gap: 12,
  },
  inputBox: {
    width: '100%',
    height: 52,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputBoxFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceBright,
    ...shadows.card,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  toggleButton: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  createButton: {
    width: '100%',
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...shadows.glowPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButtonText: {
    ...typography.labelLg,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  bottomPrompt: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  bottomSignIn: {
    ...typography.labelLg,
    color: colors.primary,
    fontWeight: '700',
  },
});
