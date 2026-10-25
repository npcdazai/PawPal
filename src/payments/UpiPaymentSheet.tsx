import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { PrimaryButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { formatMoney } from '../booking/walkPlans';
import { colors, radii, shadows } from '../theme/colors';
import { gradients, screenGradients } from '../theme/gradients';
import { fonts, typography } from '../theme/typography';
import { NATIVE_DRIVER } from '../theme/motion';
import { useResponsive } from '../theme/responsive';
import { UTR_LENGTH, cleanUtr, isValidUtr } from './upiIntent';
import { useUpiPayment, type PaymentMode, type UpiPaymentState, type UpiReceipt } from './useUpiPayment';
import type { UpiPayee } from './youpiConfig';

/** How long the "Paid" confirmation shows before the booking carries on. */
const PAID_HOLD_MS = 1400;
const UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM'] as const;
/** The screen always peeks out above the sheet; a taller body scrolls under the header. */
const SHEET_TOP_PEEK = 48;

export interface PaymentLine {
  label: string;
  /** Rupees. */
  amount: number;
}

interface UpiPaymentSheetProps {
  title: string;
  lines: readonly PaymentLine[];
  /** Rupees; what the customer pays. */
  total: number;
  description: string;
  metadata?: Record<string, string>;
  onPaid: (receipt: UpiReceipt) => void;
  onClose: () => void;
}

/** Bottom sheet that takes one UPI payment: straight from the customer's UPI app, or via a YouPI gateway. */
export function UpiPaymentSheet({ title, lines, total, description, metadata, onPaid, onClose }: UpiPaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useResponsive();
  const { mode, payee, state, pay, confirmPaid, reopen, check, cancel } = useUpiPayment();
  const [enter] = useState(() => new Animated.Value(0));
  const paidRef = useRef(onPaid);

  useEffect(() => {
    paidRef.current = onPaid;
  });

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter]);

  // Paid: show the confirmation briefly, then hand the receipt to the booking flow.
  const receipt = state.phase === 'paid' ? state.receipt : null;
  useEffect(() => {
    if (!receipt) return undefined;
    const timer = setTimeout(() => paidRef.current(receipt), PAID_HOLD_MS);
    return () => clearTimeout(timer);
  }, [receipt]);

  const startPayment = () => void pay({ amount: total, description, metadata });
  const close = () => {
    if (state.phase === 'paid') return;
    cancel();
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" aria-label="Close payment" />
      </Animated.View>
      <Animated.View
        role="dialog"
        aria-label="UPI payment"
        style={[
          styles.sheet,
          {
            maxHeight: height - insets.top - SHEET_TOP_PEEK,
            // The scroll view carries the last 18 of bottom padding, so the button's shadow isn't clipped.
            paddingBottom: insets.bottom,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
          },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.upiBadge}>
            <Text style={styles.upiBadgeText}>UPI</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {mode === 'direct' ? `To ${payee.name} · ${payee.vpa}` : 'Secure checkout · paid straight to PawPal’s bank'}
            </Text>
          </View>
          {state.phase !== 'paid' ? (
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" aria-label="Close">
              <Icon name="close" size={22} color={colors.slate} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bill}>
            {lines.map((line) => (
              <View key={line.label} style={styles.billRow}>
                <Text style={styles.billLabel}>{line.label}</Text>
                <Text style={styles.billAmount}>{formatMoney(line.amount)}</Text>
              </View>
            ))}
            <View style={[styles.billRow, styles.billTotal]}>
              <Text style={styles.totalLabel}>To pay</Text>
              <Text style={styles.totalAmount}>{formatMoney(total)}</Text>
            </View>
          </View>

          <SheetBody
            mode={mode}
            payee={payee}
            state={state}
            total={total}
            onPay={startPayment}
            onReopen={reopen}
            onCheck={() => void check()}
            onConfirm={confirmPaid}
            onCancel={close}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function SheetBody({
  mode,
  payee,
  state,
  total,
  onPay,
  onReopen,
  onCheck,
  onConfirm,
  onCancel,
}: {
  mode: PaymentMode;
  payee: UpiPayee;
  state: UpiPaymentState;
  total: number;
  onConfirm: (utr: string) => boolean;
  onPay: () => void;
  onReopen: () => void;
  onCheck: () => void;
  onCancel: () => void;
}) {
  switch (state.phase) {
    case 'idle':
      return (
        <View style={styles.body}>
          <View style={styles.methods} role="radiogroup" aria-label="Payment method">
            <Text style={styles.overline}>Pay with</Text>
            {/* The one live method: UPI (the YouPI checkout, or straight from a UPI app). */}
            <PaymentMethod
              icon="account-balance"
              title="BHIM / UPI"
              detail={`${UPI_APPS.join(', ')} or any UPI app${mode === 'direct' ? ` · to ${payee.vpa}` : ' · secure checkout'}`}
              selected
            />
            <PaymentMethod
              icon="qr-code-2"
              title="Pay at Leash Handover (In-App QR)"
              detail="Scan a QR in the app when your walker picks Barnaby up"
              comingSoon
            />
            <PaymentMethod
              icon="account-balance-wallet"
              title="Pawsome Wallet"
              detail="Pay for walks from a PawPal wallet balance"
              comingSoon
            />
          </View>

          <View style={styles.cashback}>
            <View style={styles.cashbackIcon}>
              <Icon name="redeem" size={20} color={colors.amberInk} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cashbackTitle}>Cashback rewards are coming soon</Text>
              <Text style={styles.meta}>
                This payment doesn’t earn cashback. We’ll let you know when walks start earning rewards.
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            {mode === 'direct'
              ? `Your UPI app opens with ${formatMoney(total)} filled in. Pay, then come back and enter the 12-digit UPI reference from the success screen.`
              : 'You’ll confirm your number with a WhatsApp code, then pay in your UPI app. We book the walker as soon as your bank confirms the payment.'}
          </Text>
          <PrimaryButton label={`Pay ${formatMoney(total)} with UPI`} onPress={onPay} />
        </View>
      );

    case 'confirm':
      return <ConfirmBody state={state} payee={payee} onReopen={onReopen} onConfirm={onConfirm} onRetry={onPay} onCancel={onCancel} />;

    case 'creating':
      return (
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusTitle}>Opening secure checkout…</Text>
        </View>
      );

    case 'waiting':
      return (
        <View style={styles.body}>
          <View style={styles.waitingRow}>
            <PulseDot />
            <View style={styles.flex}>
              <Text style={styles.statusTitle}>{waitingTitle(state)}</Text>
              <Text style={styles.meta}>{waitingDetail(state)}</Text>
            </View>
          </View>
          <Text style={styles.ref}>Order {state.payment.orderId}</Text>
          <PrimaryButton
            label={state.returned ? 'Open checkout again' : 'Opening checkout…'}
            trailingIcon="open-in-new"
            disabled={!state.returned}
            onPress={onReopen}
          />
          <View style={styles.linkRow}>
            <Pressable onPress={onCheck} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>I’ve paid — check now</Text>
            </Pressable>
            <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.cancelLink}>Cancel payment</Text>
            </Pressable>
          </View>
        </View>
      );

    case 'paid':
      return (
        <View style={[styles.body, styles.centered]}>
          <View style={styles.paidIcon}>
            <Icon name="check" size={34} color={colors.onPrimary} />
          </View>
          <Text style={styles.statusTitle}>{formatMoney(state.receipt.amount)} paid via UPI</Text>
          <Text style={styles.meta}>
            {state.receipt.provider === 'upi-direct'
              ? `UPI ref ${state.receipt.reference} · locking your slot…`
              : `Ref ${state.receipt.orderId} · locking your slot…`}
          </Text>
        </View>
      );

    case 'unpaid':
      return (
        <View style={styles.body}>
          <View style={styles.waitingRow}>
            <View style={[styles.outcomeIcon, state.outcome === 'FAILED' && styles.outcomeIconWarn]}>
              <Icon name={state.outcome === 'FAILED' ? 'priority-high' : 'close'} size={22} color={colors.onPrimary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.statusTitle}>{UNPAID_COPY[state.outcome].title}</Text>
              <Text style={styles.meta}>{UNPAID_COPY[state.outcome].detail}</Text>
            </View>
          </View>
          <Text style={styles.ref}>Order {state.payment.orderId}</Text>
          <PrimaryButton label="Try again" trailingIcon="refresh" onPress={onPay} />
          <Pressable onPress={onCancel} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.cancelLink}>Close</Text>
          </Pressable>
        </View>
      );

    case 'error':
      return (
        <View style={styles.body}>
          <View style={styles.waitingRow}>
            <View style={[styles.outcomeIcon, styles.outcomeIconWarn]}>
              <Icon name="wifi-off" size={20} color={colors.onPrimary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.statusTitle}>Payment couldn’t start</Text>
              <Text style={styles.meta}>{state.message}</Text>
            </View>
          </View>
          {__DEV__ && mode === 'gateway' ? (
            <Text style={styles.devHint}>
              Dev: check EXPO_PUBLIC_YOUPI_URL points at a running YouPI gateway this phone can reach (for the test
              gateway: http://&lt;computer-LAN-IP&gt;:7000), then restart Metro.
            </Text>
          ) : null}
          <PrimaryButton label="Try again" trailingIcon="refresh" onPress={onPay} />
          <Pressable onPress={onCancel} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.cancelLink}>Close</Text>
          </Pressable>
        </View>
      );
  }
}

/**
 * One payment method. UPI is the only live one, so it is always the selected
 * radio; the others are shown, marked "Coming soon", and can't be chosen.
 */
function PaymentMethod({
  icon,
  title,
  detail,
  selected = false,
  comingSoon = false,
}: {
  icon: string;
  title: string;
  detail: string;
  selected?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <View
      accessible
      role="radio"
      aria-checked={selected}
      aria-disabled={comingSoon}
      aria-label={comingSoon ? `${title}, coming soon` : title}
      style={[styles.method, selected && styles.methodSelected, comingSoon && styles.methodSoon]}
    >
      <View style={[styles.methodIcon, comingSoon && styles.methodIconSoon]}>
        <Icon name={icon} size={20} color={comingSoon ? colors.slate : colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.methodTitle, comingSoon && styles.methodTitleSoon]}>{title}</Text>
        <Text style={styles.methodDetail}>{detail}</Text>
        {comingSoon ? <Badge label="Coming soon" tone="amber" style={styles.soonBadge} /> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn, comingSoon && styles.radioSoon]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </View>
  );
}

/**
 * Direct UPI, after the UPI app was opened: the app can't see the bank, so the
 * customer confirms with the 12-digit reference their UPI app shows on success.
 */
function ConfirmBody({
  state,
  payee,
  onReopen,
  onConfirm,
  onRetry,
  onCancel,
}: {
  state: Extract<UpiPaymentState, { phase: 'confirm' }>;
  payee: UpiPayee;
  onReopen: () => void;
  onConfirm: (utr: string) => boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const [utr, setUtr] = useState('');
  const valid = isValidUtr(utr);

  return (
    <View style={styles.body}>
      <View style={styles.waitingRow}>
        <PulseDot />
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>{state.returned ? 'Did the payment go through?' : 'Finish in your UPI app'}</Text>
          <Text style={styles.meta}>
            Pay {formatMoney(state.amount)} to {payee.vpa}, then enter the 12-digit UPI reference (UTR / UPI Ref No.)
            from the success screen.
          </Text>
        </View>
      </View>

      <TextInput
        value={utr}
        onChangeText={(text) => setUtr(cleanUtr(text))}
        keyboardType="number-pad"
        placeholder="12-digit UPI reference"
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.primary}
        aria-label="UPI reference number"
        style={[styles.utrInput, valid && styles.utrValid]}
      />
      <Text style={styles.ref}>
        Order {state.orderId} · {utr.length}/{UTR_LENGTH}
      </Text>

      <PrimaryButton label="I’ve paid — confirm" trailingIcon="check" disabled={!valid} onPress={() => onConfirm(utr)} />
      <View style={styles.linkRow}>
        <Pressable onPress={onReopen} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Open UPI app again</Text>
        </Pressable>
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.cancelLink}>Payment failed? Try again</Text>
        </Pressable>
      </View>
      <Pressable onPress={onCancel} accessibilityRole="button" style={styles.closeButton}>
        <Text style={styles.metaLink}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const UNPAID_COPY = {
  FAILED: {
    title: 'We couldn’t confirm your payment',
    detail: 'If money left your account, it’s matched within 30 minutes or refunded. Quote the order number to support.',
  },
  EXPIRED: {
    title: 'The payment window closed',
    detail: 'The 5 minutes to pay ran out, and nothing was charged.',
  },
  CANCELLED: {
    title: 'Payment cancelled',
    detail: 'Nothing was charged.',
  },
} as const;

type WaitingState = Extract<UpiPaymentState, { phase: 'waiting' }>;

function waitingTitle(state: WaitingState): string {
  if (state.offline) return 'Reconnecting to the payment server…';
  switch (state.status) {
    case 'QUEUED':
      return 'You’re next in line';
    case 'ACTIVE':
      return 'Pay in your UPI app';
    case 'PROCESSING':
      return 'Checking with your bank…';
    default:
      return state.returned ? 'Finish on the checkout page' : 'Checkout is open';
  }
}

function waitingDetail(state: WaitingState): string {
  switch (state.status) {
    case 'QUEUED':
      return state.payment.queuePosition
        ? `Position ${state.payment.queuePosition} — another payment to this account is finishing.`
        : 'Another payment to this account is finishing.';
    case 'ACTIVE':
      return 'Scan the QR or tap your UPI app on the checkout page. You have 5 minutes.';
    case 'PROCESSING':
      return 'Matching your payment with the bank alert. This takes up to 30 seconds.';
    default:
      return 'Sign in with the WhatsApp code on the checkout page to start your payment.';
  }
}

function PulseDot() {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ring = useMemo(
    () => ({
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }],
    }),
    [pulse]
  );
  return (
    <View style={styles.pulse}>
      <Animated.View style={[styles.pulseRing, ring]} />
      <View style={styles.pulseDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24, 26, 32, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 14,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    // CROWN: a warm glow under the handle fading to white, so cards and inputs stay crisp.
    backgroundColor: colors.card,
    backgroundImage: screenGradients.CROWN,
    ...shadows.float,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(24, 26, 32, 0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  // Full sheet width, with the sheet's side padding inside it, so shadows aren't clipped at the content edge.
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    marginHorizontal: -20,
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  upiBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  upiBadgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    letterSpacing: 0.5,
    color: colors.primary,
  },
  title: {
    ...typography.headline,
  },
  meta: {
    ...typography.bodySm,
  },
  bill: {
    gap: 8,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    ...typography.body,
    color: colors.ink,
  },
  billAmount: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  billTotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(24, 26, 32, 0.08)',
  },
  totalLabel: {
    ...typography.subhead,
  },
  totalAmount: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.amberInk,
  },
  body: {
    gap: 14,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  methods: {
    gap: 8,
  },
  overline: {
    ...typography.overline,
    marginLeft: 2,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
  },
  methodSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F7FAFF',
  },
  methodSoon: {
    backgroundColor: colors.input,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  methodIconSoon: {
    backgroundColor: colors.track,
  },
  methodTitle: {
    ...typography.subhead,
    fontSize: 14,
  },
  methodTitleSoon: {
    color: colors.slate,
  },
  methodDetail: {
    ...typography.bodySm,
    marginTop: 1,
  },
  soonBadge: {
    marginTop: 6,
  },
  // 24 dp radio: a grey ring, or Primary Blue with a white centre when chosen.
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.placeholder,
    backgroundColor: colors.card,
  },
  radioOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioSoon: {
    borderColor: colors.inputBorder,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.onPrimary,
  },
  cashback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.amberTint,
    backgroundImage: gradients.cashbackBanner,
  },
  cashbackIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  cashbackTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.amberInk,
  },
  note: {
    ...typography.body,
    fontSize: 13,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusTitle: {
    ...typography.subhead,
    fontSize: 16,
    textAlign: 'left',
  },
  ref: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slate,
    letterSpacing: 0.3,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  cancelLink: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.coralInk,
  },
  closeButton: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  paidIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    marginBottom: 4,
  },
  outcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate,
  },
  outcomeIconWarn: {
    backgroundColor: colors.coral,
  },
  utrInput: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.ink,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  utrValid: {
    borderColor: colors.success,
  },
  metaLink: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.slate,
  },
  devHint: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.amberInk,
    padding: 10,
    borderRadius: radii.md,
    backgroundColor: colors.amberTint,
  },
  pulse: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
});
