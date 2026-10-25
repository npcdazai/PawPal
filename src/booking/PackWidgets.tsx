import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { errorMessage } from '../api/errors';
import { useChangeSlot, usePricing, useSkipWalk } from '../api/queries';
import type { PackBackup, PackWalker, Pricing, Subscription } from '../api/types';
import { ActionSheet, type ActionSheetOption } from '../components/ActionSheet';
import { Icon } from '../components/Icon';
import { colors, radii } from '../theme/colors';
import { gradients } from '../theme/gradients';
import { NATIVE_DRIVER } from '../theme/motion';
import { fonts } from '../theme/typography';
import { packSlots, planPriceLine, skipLabel } from './homeModel';
import { SOCIETIES, type SocietyKey } from './societies';
import { clockLabel, formatMoney } from './walkPlans';

/** Pieces shared by the home pack card and the Subscription tab. */

export const CALL_SOON = 'Calling your walker is coming soon';

const BLUE_WASH = '#E8F0FE';
const RING_RAIL = '#F0F4FF';

/** "18 / 26 Walks" around a Primary Blue progress ring. */
export function ProgressRing({ done, total, size = 80 }: { done: number; total: number; size?: number }) {
  const stroke = size * 0.1;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <View
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={`${done} of ${total} walks booked`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <Svg width={size} height={size} style={styles.ringSvg}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={RING_RAIL} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - share)}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringValue}>
          {done} / {total}
        </Text>
        <Text style={styles.ringLabel}>Walks</Text>
      </View>
    </View>
  );
}

/** "MyGate ID: #4092", with the society's own gate app when the app knows it. */
const gatePassLine = (pass: string, societyId: string | undefined) =>
  `${(societyId && SOCIETIES[societyId as SocietyKey]?.gateApp) || 'Gate pass'} ID: #${pass}`;

/** The pack's primary walker: initials, name, rating, gate pass, verified, and the call button. */
export function WalkerRow({
  walker,
  societyId,
  onCall,
}: {
  walker: PackWalker | null;
  societyId?: string;
  onCall: () => void;
}) {
  if (!walker) {
    return (
      <View style={styles.walkerRow}>
        <View style={[styles.walkerAvatar, styles.walkerAvatarEmpty]}>
          <Icon name="person-search" size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.walkerName}>Walker not assigned yet</Text>
          <Text style={styles.walkerMeta}>Your society walker is set when the first walk is accepted.</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.walkerRow}>
      <View style={styles.walkerAvatar}>
        <Text style={styles.walkerInitials}>{walker.initials}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.walkerName} numberOfLines={1}>
          {walker.name}
          {walker.rating ? <Text style={styles.walkerRating}>{`  ⭐ ${walker.rating.average.toFixed(2)}`}</Text> : null}
        </Text>
        {walker.gatePass || walker.verified ? (
          <Text style={styles.walkerMeta} numberOfLines={1}>
            {walker.gatePass ? gatePassLine(walker.gatePass, societyId) : ''}
            {walker.gatePass && walker.verified ? ' ' : ''}
            {walker.verified ? <Text style={styles.verified}>✓ Verified</Text> : null}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onCall}
        accessibilityRole="button"
        aria-label={`Call ${walker.name}`}
        hitSlop={6}
        style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
      >
        <Icon name="call" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

/** "🔄 Auto-Backup Ready…"; tap shows how the backup would cover the slot. */
export function BackupStrip({
  backup,
  walkerName,
  slotLabel,
}: {
  backup: PackBackup | null;
  walkerName: string | null;
  slotLabel: string;
}) {
  const [open, setOpen] = useState(false);
  if (!backup) {
    return (
      <View style={[styles.backupBase, styles.backupMuted]}>
        <Text style={styles.backupMutedText}>
          🔄 A backup walker is picked once {walkerName ? `${firstName(walkerName)} is` : 'your walker is'} set.
        </Text>
      </View>
    );
  }
  const primary = walkerName ? firstName(walkerName) : 'your walker';
  return (
    <Pressable
      onPress={() => setOpen((value) => !value)}
      accessibilityRole="button"
      aria-expanded={open}
      style={({ pressed }) => [styles.backupBase, styles.backupMint, pressed && styles.pressedSoft]}
    >
      <View style={styles.backupRow}>
        <Text style={styles.backupText}>
          🔄 Auto-Backup Ready: {backup.name} covers automatically if {primary} is on leave.
        </Text>
        <Icon name={open ? 'expand-less' : 'expand-more'} size={18} color={colors.successInk} />
      </View>
      {open ? (
        <View style={styles.backupPreview}>
          <View style={styles.backupAvatar}>
            <Text style={styles.backupInitials}>{backup.initials}</Text>
          </View>
          <Text style={styles.backupPreviewText}>
            If {primary} can’t make it, {backup.name} takes your {slotLabel} slot — same doorstep OTP, same society
            loop. You’ll get a notification when they’re on the way.
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** A soft pulsing block while data loads. */
export function Skeleton({
  width = '100%',
  height,
  radius = 12,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      aria-hidden
      style={[{ width, height, borderRadius: radius, backgroundColor: 'rgba(24, 26, 32, 0.07)', opacity: pulse }, style]}
    />
  );
}

/** Instead of a blank card: what failed, and a way to try again. */
export function RetryRow({ message, onRetry, busy = false }: { message: string; onRetry: () => void; busy?: boolean }) {
  return (
    <View style={styles.retry} role="alert">
      <Icon name="cloud-off" size={18} color={colors.coralInk} />
      <Text style={styles.retryText}>{message}</Text>
      <Pressable
        onPress={onRetry}
        disabled={busy}
        accessibilityRole="button"
        hitSlop={6}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed, busy && styles.busy]}
      >
        <Text style={styles.retryButtonText}>{busy ? 'Retrying…' : 'Retry'}</Text>
      </Pressable>
    </View>
  );
}

/** The honest empty state when there's no active pack: ₹120/walk × 26 from /pricing. */
export function StartPlanCard({
  pricing,
  onStart,
  style,
}: {
  pricing: Pricing | undefined;
  onStart: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.startCard, style]}>
      <View style={styles.startBadge}>
        <Text style={styles.startBadgeText}>📅 MONTHLY SOCIETY SUBSCRIPTION</Text>
      </View>
      <Text style={styles.startTitle}>Start a monthly society plan</Text>
      <Text style={styles.startCopy}>
        A fixed daily 30-minute slot inside your township, the same verified walker every day and an automatic backup
        if they’re on leave.
      </Text>
      {pricing ? (
        <Text style={styles.startPrice}>
          {planPriceLine(pricing)} • {formatMoney(pricing.subscription.total)} a month
        </Text>
      ) : null}
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
      >
        <Text style={styles.startButtonText}>Choose my daily slot</Text>
        <Icon name="arrow-forward" size={16} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

/**
 * Hosts a bottom sheet above everything, the common tab bar included (it's
 * drawn over the screens by the root layout).
 */
export function SheetModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {children}
    </Modal>
  );
}

/**
 * "Reschedule / Skip": skip the next walk, or move the daily time to another
 * batch slot. Results (and the server's refusals) come back through `onResult`.
 */
export function RescheduleSheet({
  pack,
  now,
  onClose,
  onResult,
}: {
  pack: Subscription;
  now: number;
  onClose: () => void;
  onResult: (message: string) => void;
}) {
  const [step, setStep] = useState<'menu' | 'time'>('menu');
  const skip = useSkipWalk();
  const change = useChangeSlot();
  const { data: pricing } = usePricing();
  const skipText = skipLabel(pack.nextWalk, now);

  const run = <T,>(promise: Promise<T>, success: string) => {
    onClose();
    promise.then(
      () => onResult(success),
      (error: unknown) => onResult(errorMessage(error))
    );
  };

  if (step === 'time') {
    const options: ActionSheetOption[] = packSlots(pricing).map(({ slotMinute, label }) => ({
      icon: slotMinute < 720 ? 'wb-twilight' : 'nights-stay',
      label,
      detail: slotMinute === pack.slotMinute ? 'Your current time' : undefined,
      onPress: () => {
        if (slotMinute === pack.slotMinute) {
          onClose();
          return;
        }
        run(
          change.mutateAsync({ id: pack.id, slotMinute }),
          `Daily walk moved to ${clockLabel(slotMinute)} from the next walk without a walker`
        );
      },
    }));
    return (
      <SheetModal onClose={() => setStep('menu')}>
        <ActionSheet
          title="Change daily time"
          subtitle="Batch slots inside your society. A walk that already has a walker keeps its time."
          options={options}
          cancelLabel="Back"
          onClose={() => setStep('menu')}
        />
      </SheetModal>
    );
  }

  const options: ActionSheetOption[] = [
    ...(skipText && pack.status === 'active'
      ? [
          {
            icon: 'event-busy',
            label: skipText,
            detail: 'It’s credited back to your pack',
            tone: 'coral' as const,
            onPress: () =>
              run(
                skip.mutateAsync({ id: pack.id, date: pack.nextWalk?.date || undefined }),
                `${skipText.replace(/^Skip /, 'Skipped ')} — credited back to your pack`
              ),
          },
        ]
      : []),
    {
      icon: 'schedule',
      label: 'Change daily time',
      detail: `Now ${pack.slotLabel}`,
      onPress: () => setStep('time'),
    },
  ];
  return (
    <SheetModal onClose={onClose}>
      <ActionSheet title="Reschedule / Skip" subtitle={`Daily ${pack.slotLabel} slot`} options={options} onClose={onClose} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  ringSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.primary,
  },
  ringLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    color: colors.slate,
  },
  walkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walkerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_WASH,
    borderWidth: 1,
    borderColor: '#D3E1FD',
  },
  walkerAvatarEmpty: {
    borderStyle: 'dashed',
  },
  walkerInitials: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    color: colors.primary,
  },
  walkerName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.ink,
  },
  walkerRating: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#E39A00',
  },
  walkerMeta: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.slate,
  },
  verified: {
    fontFamily: fonts.bold,
    color: colors.successInk,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    boxShadow: '0px 2px 6px rgba(24, 26, 32, 0.06)',
  },
  backupBase: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backupMint: {
    backgroundImage: gradients.mintStrip,
    backgroundColor: '#E8F8F0',
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backupText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#11663A',
  },
  backupMuted: {
    backgroundColor: '#F4F6FA',
  },
  backupMutedText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.slate,
  },
  backupPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(23, 138, 76, 0.15)',
  },
  backupAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  backupInitials: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    color: colors.successInk,
  },
  backupPreviewText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#11663A',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.coralTint,
  },
  retryText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.ink,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.card,
  },
  retryButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.coralInk,
  },
  busy: {
    opacity: 0.6,
  },
  startCard: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundImage: gradients.subscriptionCard,
    backgroundColor: colors.card,
    boxShadow: '0px 14px 32px rgba(41, 98, 255, 0.08)',
  },
  startBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: BLUE_WASH,
  },
  startBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  startTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  startCopy: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.slate,
  },
  startPrice: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    marginTop: 6,
    borderRadius: radii.full,
    backgroundImage: gradients.primaryPill,
    backgroundColor: colors.primary,
    boxShadow: '0px 8px 20px rgba(41, 98, 255, 0.28)',
  },
  startButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  pressedSoft: {
    opacity: 0.9,
  },
});
