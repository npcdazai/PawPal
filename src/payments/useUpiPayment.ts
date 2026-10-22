import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { upiPayee, youpiConfig, type UpiPayee, type YoupiConfig } from './youpiConfig';
import { isValidUtr, upiPayUrl } from './upiIntent';
import {
  cancelPayment,
  createPayment,
  getPayment,
  isOutcome,
  YoupiError,
  type YoupiOutcome,
  type YoupiPayment,
} from './youpiClient';

/** Deep link the checkout page returns to; +native-intent keeps it from opening a screen. */
export const PAYMENT_RETURN_PATH = 'payment-return';

const POLL_MS = 2500;

/** Proof of a UPI payment, kept with the booking. */
export interface UpiReceipt {
  /** 'youpi': confirmed by the gateway; 'upi-direct': paid from the customer's UPI app. */
  provider: 'youpi' | 'upi-direct';
  /** The gateway's payment id, or the customer's 12-digit UPI reference (UTR). */
  reference: string;
  orderId: string;
  /** Rupees. */
  amount: number;
  paidAt: number;
  /** Gateway-confirmed. Direct payments are matched against the bank statement later. */
  verified: boolean;
}

export type PaymentMode = 'gateway' | 'direct';

export type UpiPaymentState =
  | { phase: 'idle' }
  | { phase: 'creating' }
  | {
      phase: 'waiting';
      payment: YoupiPayment;
      status: string;
      /** The customer has come back from the checkout page at least once. */
      returned: boolean;
      /** The last status check couldn't reach the gateway. */
      offline: boolean;
    }
  | {
      /** Direct UPI: the UPI app was opened; the customer confirms with the UTR. */
      phase: 'confirm';
      orderId: string;
      amount: number;
      url: string;
      /** The customer is back from the UPI app. */
      returned: boolean;
    }
  | { phase: 'paid'; receipt: UpiReceipt }
  | { phase: 'unpaid'; payment: YoupiPayment; outcome: Exclude<YoupiOutcome, 'SUCCESS'> }
  | { phase: 'error'; message: string };

export interface UpiPaymentRequest {
  /** Rupees. */
  amount: number;
  description: string;
  metadata?: Record<string, string>;
}

interface GatewaySession {
  config: YoupiConfig;
  payment: YoupiPayment;
  settled: boolean;
}

const newOrderId = () =>
  `PAWPAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const hasNativeBrowser = () => requireOptionalNativeModule('ExpoWebBrowser') !== null;

/**
 * The in-app browser (Chrome Custom Tab / SafariViewController) when this build
 * includes expo-web-browser, else the system browser. Resolves when the
 * customer is back in the app (or straight away for the system browser; the
 * AppState listener notices their return then).
 */
async function openCheckout(url: string, returnUrl: string | undefined) {
  if (Platform.OS === 'web') {
    const WebBrowser = await import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url);
    return;
  }
  if (hasNativeBrowser()) {
    const WebBrowser = await import('expo-web-browser');
    if (returnUrl) await WebBrowser.openAuthSessionAsync(url, returnUrl);
    else await WebBrowser.openBrowserAsync(url);
    return;
  }
  await Linking.openURL(url);
}

/** iOS can close the checkout sheet for the customer; Android Custom Tabs can't be closed by the app. */
async function closeCheckout() {
  if (Platform.OS !== 'ios' || !hasNativeBrowser()) return;
  const WebBrowser = await import('expo-web-browser');
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    // Already closed.
  }
}

/**
 * One UPI payment, either straight from the customer's UPI app to PawPal's UPI
 * ID (default), or through a YouPI gateway when EXPO_PUBLIC_YOUPI_URL is set
 * (hosted checkout + bank-alert verification, polled until it reports an outcome).
 */
export function useUpiPayment() {
  const [mode] = useState<PaymentMode>(() => (youpiConfig() ? 'gateway' : 'direct'));
  const [payee] = useState<UpiPayee>(upiPayee);
  const [state, setState] = useState<UpiPaymentState>({ phase: 'idle' });
  const session = useRef<GatewaySession | null>(null);

  // ─── Gateway (YouPI) ──────────────────────────────────────────────────────

  const apply = useCallback((current: GatewaySession, latest: YoupiPayment) => {
    if (session.current !== current || current.settled) return;
    const payment = { ...current.payment, ...latest, checkoutUrl: current.payment.checkoutUrl };
    current.payment = payment;
    if (payment.status === 'SUCCESS') {
      current.settled = true;
      const paidAt = payment.completedAt ? Date.parse(payment.completedAt) : NaN;
      setState({
        phase: 'paid',
        receipt: {
          provider: 'youpi',
          reference: payment.paymentId,
          orderId: payment.orderId,
          amount: Number(payment.amount),
          paidAt: Number.isFinite(paidAt) ? paidAt : Date.now(),
          verified: true,
        },
      });
      void closeCheckout();
    } else if (isOutcome(payment.status)) {
      current.settled = true;
      setState({ phase: 'unpaid', payment, outcome: payment.status as Exclude<YoupiOutcome, 'SUCCESS'> });
      void closeCheckout();
    } else {
      setState((prev) =>
        prev.phase === 'waiting' ? { ...prev, payment, status: payment.status, offline: false } : prev
      );
    }
  }, []);

  const check = useCallback(async () => {
    const current = session.current;
    if (!current || current.settled) return;
    try {
      apply(current, await getPayment(current.config, current.payment.paymentId));
    } catch {
      if (session.current === current) {
        setState((prev) => (prev.phase === 'waiting' ? { ...prev, offline: true } : prev));
      }
    }
  }, [apply]);

  /** After the checkout page closes (or the app returns), look again at once. */
  const openAndWatch = useCallback(
    async (current: GatewaySession, returnUrl: string | undefined) => {
      try {
        await openCheckout(current.payment.checkoutUrl ?? '', returnUrl);
      } catch {
        // The customer can reopen it from the sheet.
      }
      if (session.current !== current) return;
      setState((prev) => (prev.phase === 'waiting' ? { ...prev, returned: true } : prev));
      void check();
    },
    [check]
  );

  const payWithGateway = useCallback(
    async (config: YoupiConfig, request: UpiPaymentRequest) => {
      session.current = null;
      setState({ phase: 'creating' });
      const orderId = newOrderId();
      // On web the checkout opens in a tab the customer closes; deep links are for the apps.
      const returnUrl =
        Platform.OS === 'web' ? undefined : Linking.createURL(PAYMENT_RETURN_PATH, { queryParams: { order: orderId } });
      let payment: YoupiPayment;
      try {
        payment = await createPayment(config, {
          orderId,
          amount: request.amount,
          description: request.description,
          returnUrl,
          metadata: request.metadata,
        });
      } catch (error) {
        setState({
          phase: 'error',
          message: error instanceof YoupiError ? error.message : 'Couldn’t start the UPI payment.',
        });
        return;
      }
      const current: GatewaySession = { config, payment, settled: false };
      session.current = current;
      if (isOutcome(payment.status)) {
        apply(current, payment);
        return;
      }
      setState({ phase: 'waiting', payment, status: payment.status, returned: false, offline: false });
      await openAndWatch(current, returnUrl);
    },
    [apply, openAndWatch]
  );

  // ─── Direct UPI ───────────────────────────────────────────────────────────

  const openUpiApp = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setState({
        phase: 'error',
        message: 'No UPI app opened. Install GPay, PhonePe, Paytm or BHIM on this phone, then try again.',
      });
    }
  }, []);

  const payDirect = useCallback(
    (request: UpiPaymentRequest) => {
      const orderId = newOrderId();
      const url = upiPayUrl(payee, request.amount, `PawPal ${orderId}`);
      setState({ phase: 'confirm', orderId, amount: request.amount, url, returned: false });
      void openUpiApp(url);
    },
    [openUpiApp, payee]
  );

  /** Direct UPI: the customer read the 12-digit reference off their UPI app's success screen. */
  const confirmPaid = useCallback(
    (utr: string) => {
      if (state.phase !== 'confirm' || !isValidUtr(utr)) return false;
      setState({
        phase: 'paid',
        receipt: {
          provider: 'upi-direct',
          reference: utr,
          orderId: state.orderId,
          amount: state.amount,
          paidAt: Date.now(),
          verified: false,
        },
      });
      return true;
    },
    [state]
  );

  // ─── Shared ───────────────────────────────────────────────────────────────

  const pay = useCallback(
    (request: UpiPaymentRequest) => {
      const config = youpiConfig();
      if (config) void payWithGateway(config, request);
      else payDirect(request);
    },
    [payDirect, payWithGateway]
  );

  /** Bring the checkout page / UPI app back, e.g. after leaving it half-way. */
  const reopen = useCallback(() => {
    if (state.phase === 'confirm') {
      void openUpiApp(state.url);
      return;
    }
    const current = session.current;
    if (!current || current.settled) return;
    void openAndWatch(current, undefined);
  }, [openAndWatch, openUpiApp, state]);

  /** Give up on this payment (and free the gateway's single payment slot, if any). */
  const cancel = useCallback(() => {
    const current = session.current;
    session.current = null;
    if (current && !current.settled) {
      current.settled = true;
      cancelPayment(current.config, current.payment.paymentId).catch(() => undefined);
    }
    setState({ phase: 'idle' });
  }, []);

  // Gateway: poll while a payment is open, and re-check the moment the app is in front again.
  const waitingId = state.phase === 'waiting' ? state.payment.paymentId : null;
  useEffect(() => {
    if (!waitingId) return undefined;
    const timer = setInterval(() => void check(), POLL_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [waitingId, check]);

  // Direct: notice the customer coming back from their UPI app.
  const confirming = state.phase === 'confirm';
  useEffect(() => {
    if (!confirming) return undefined;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setState((prev) => (prev.phase === 'confirm' ? { ...prev, returned: true } : prev));
    });
    return () => subscription.remove();
  }, [confirming]);

  // Leaving mid-payment cancels a gateway payment, so its slot doesn't stay held for 5 minutes.
  useEffect(
    () => () => {
      const current = session.current;
      if (current && !current.settled) {
        current.settled = true;
        cancelPayment(current.config, current.payment.paymentId).catch(() => undefined);
      }
    },
    []
  );

  return { mode, payee, state, pay, confirmPaid, reopen, check, cancel };
}
