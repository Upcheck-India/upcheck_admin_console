'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ConsoleNav from './components/ConsoleNav';
import { useAuth } from '../../hooks/useAuth';

export default function ConsoleAdminLayout({ children }) {
  // Use useAuth with required authentication
  const { isAuthenticated, user, isLoading, authError } = useAuth(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    console.log('Auth state changed:', { 
      isAuthenticated, 
      user: user ? 'User data available' : 'No user data',
      isLoading,
      authError,
      hasUser: !!user,
      userKeys: user ? Object.keys(user) : []
    });
    
    // Only proceed if we're not loading and authenticated
    if (!isLoading && isAuthenticated) {
      console.log('Processing authentication...');
      
      // If we have a user object, check their role
      if (user) {
        console.log('User object structure:', JSON.stringify(user, null, 2));
        
        // Try to extract the role from different possible locations
        const userRole = user.role || 
                        (user.data && user.data.role) || 
                        (user.user && user.user.role) ||
                        (user.userData && user.userData.role) ||
                        (user.roleName);
        
        console.log('Extracted role:', userRole);
        
        if (userRole) {
          // Normalize the role for comparison
          const normalizedRole = userRole.toString().toLowerCase().replace(/\s+/g, '_');
          const hasAccess = ['admin', 'console_admin', 'superadmin', 'administrator'].includes(normalizedRole);
          
          console.log('Access check:', { 
            userRole, 
            normalizedRole, 
            hasAccess 
          });
          
          if (hasAccess) {
            console.log('Access granted with role:', userRole);
            setIsAuthorized(true);
            setInitialCheckComplete(true);
          } else {
            console.warn('Access denied. Insufficient role:', userRole);
            router.push('/unauthorized');
          }
        } else {
          console.warn('No role found in user object');
          router.push('/unauthorized');
        }
      } else {
        console.warn('No user data available, please retry login');
        router.push('/login');
      }
    } else if (!isLoading && !isAuthenticated) {
      console.log('User is not authenticated, redirecting to home page');
      router.push('/console');
    }
  }, [isAuthenticated, user, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show nothing until we've determined authorization
  if (!isAuthenticated || !isAuthorized) {
    return null;
  }

  // Only render the layout if we're authenticated and authorized
  if (isAuthenticated && isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="fixed top-0 left-0 h-full z-10">
          <ConsoleNav />
        </div>
        <main className="flex-1 ml-64">
          <div className="p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {children}
            </div>
          </div>
        </main>
      </div>
    );
  }
}
