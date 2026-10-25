import { useCallback, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

/**
 * Refreshes the given queries when the screen comes back into focus (a tab
 * switch, or back from a pushed screen), but not on its first focus, when they
 * have only just loaded (APP_INTEGRATION §3: lists refresh on focus).
 */
export function useRefetchOnFocus(keys: readonly QueryKey[]) {
  const queryClient = useQueryClient();
  const seen = useRef(false);
  const signature = JSON.stringify(keys);
  useFocusEffect(
    useCallback(() => {
      if (!seen.current) {
        seen.current = true;
        return;
      }
      for (const queryKey of JSON.parse(signature) as QueryKey[]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }, [queryClient, signature])
  );
}
