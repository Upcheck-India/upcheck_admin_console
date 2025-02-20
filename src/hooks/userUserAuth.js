// src/hooks/useUserAuth.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { roles } from '../utils/roles';

export function useUserAuth(requiredPermission = null, redirectUrl = '/login') {
  const [authStatus, setAuthStatus] = useState('loading');
  const [hasPermission, setHasPermission] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();

        if (!data.authenticated) {
          router.push(redirectUrl);
          setAuthStatus('unauthenticated');
          return;
        }

        if (requiredPermission && !data.permissions.includes(requiredPermission)) {
          router.push('/unauthorized');
          setAuthStatus('unauthenticated');
          return;
        }

        setHasPermission(true);
        setAuthStatus('authenticated');
      } catch (error) {
        setAuthStatus('error');
      }
    };

    checkAuthentication();
  }, [requiredPermission, redirectUrl, router]);

  return { authStatus, hasPermission };
}