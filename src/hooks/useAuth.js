// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth(requireAuth = true) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        });

        const isAuthed = response.ok;
        setIsAuthenticated(isAuthed);

        if (requireAuth && !isAuthed) {
          router.push('/login');
        } else if (!requireAuth && isAuthed) {
          router.push('/console');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (requireAuth) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [requireAuth, router]);

  return { isLoading, isAuthenticated };
}