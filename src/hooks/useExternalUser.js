'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The external portal's session hook — the replacement for Clerk's
 * useAuth/useUser/useClerk trio.
 *
 * There is no client-side session store because there cannot be one: the
 * session lives in the httpOnly `external_user_token` cookie, which JavaScript
 * cannot read by design. The only way to learn who is signed in is to ask the
 * server, so that is what this does.
 */
export default function useExternalUser({ redirectTo = null } = {}) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/dataroom/external-auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setUser(data?.authenticated ? data.user : null);
        setExpiresAt(data?.sessionExpiresAt ?? null);
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoaded && !user && redirectTo) router.replace(redirectTo);
  }, [isLoaded, user, redirectTo, router]);

  const signOut = useCallback(
    async (to = '/dataroom/external/login') => {
      await fetch('/api/dataroom/external-auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      setUser(null);
      router.replace(to);
    },
    [router],
  );

  return { user, expiresAt, isLoaded, isSignedIn: !!user, signOut };
}
