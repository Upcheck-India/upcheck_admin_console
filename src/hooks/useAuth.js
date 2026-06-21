// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth(requireAuth = true, requiredPermission = null) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const { push } = router;

  useEffect(() => {
    const checkAuthAndPermissions = async () => {
      try {
        console.log('Checking authentication...');
        // Check authentication
        const authResponse = await fetch('/api/auth/check', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!authResponse.ok) {
          console.log('Authentication failed');
          if (requireAuth) {
            push('/login');
          }
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        const responseData = await authResponse.json();
        console.log('Authentication response:', responseData);
        
        // Handle different response structures
        const userData = responseData.user || responseData;
        
        if (!userData) {
          throw new Error('No user data in response');
        }
        
        console.log('Setting user data:', userData);
        setIsAuthenticated(true);
        setUser(userData);

        // If permission check is required
        if (requiredPermission) {
          console.log('Checking permissions...');
          const permResponse = await fetch('/api/auth/permissions', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!permResponse.ok) {
            throw new Error('Permission check failed');
          }

          const permissionsData = await permResponse.json();
          const permissions = permissionsData.permissions || [];
          const permitted = permissions.includes(requiredPermission);
          setHasPermission(permitted);

          if (!permitted) {
            setAuthError('Permission denied');
          } else {
            setAuthError(null);
          }
        } else {
          setHasPermission(true);
        }
      } catch (error) {
        console.error('Auth/Permission check error:', error);
        setAuthError(error.message);
        setHasPermission(false);
      } finally {
        console.log('Setting isLoading to false');
        setIsLoading(false);
      }
    };

    checkAuthAndPermissions();
  }, [requireAuth, requiredPermission, push]);

  return { isLoading, isAuthenticated, hasPermission, authError, user };
}