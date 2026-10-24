import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queries';
import type { Me, PhoneSession } from '../api/types';
import { devLog } from '../monitoring/devLog';
import { unregisterPush } from '../notifications/push';
import { signOutOfPhone } from './phoneSignIn';
import { clearSession, onSessionCleared, restoreSession, saveSession } from './session';

/** `restoring` while the stored session is read at launch. */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  /** Keeps the session from POST /auth/phone; the route guard then opens the app. */
  signIn: (session: PhoneSession) => Promise<void>;
  /** Unregisters push, ends the session and returns to sign-in. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const log = devLog('auth');

/**
 * Whether someone is signed in. Only that: who they are is server data, in
 * React Query (`useMe`). The token itself stays in the session module. Any
 * request the server answers with 401 `session_required` ends the session
 * here too, which drops every cached query and sends the app to sign-in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');

  useEffect(() => {
    let live = true;
    void restoreSession().then((token) => {
      if (live) setStatus((current) => (current === 'restoring' ? (token ? 'signedIn' : 'signedOut') : current));
    });
    const unsubscribe = onSessionCleared(() => {
      setStatus('signedOut');
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(
    async ({ sessionToken, user }: PhoneSession) => {
      await saveSession(sessionToken);
      queryClient.setQueryData<Me>(queryKeys.me, { user, app: 'customer', partner: null });
      setStatus('signedIn');
    },
    [queryClient]
  );

  const signOut = useCallback(async () => {
    await unregisterPush();
    await signOutOfPhone();
    await clearSession();
    log.info('Signed out');
  }, []);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
