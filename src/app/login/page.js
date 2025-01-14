//src/app/login/page.js

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Loader2 } from 'lucide-react';
import { AlertMessage } from "../components/AlertMessage";
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setAlert({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    try {
      setIsLoading(true);
      setAlert({ type: 'loading', message: 'Authenticating...' });

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include' // Important: This ensures cookies are sent/received
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAlert({ type: 'success', message: 'Login successful!' });
        localStorage.setItem('username', username);
        
        // Verify the cookie is set before redirecting
        const checkAuth = await fetch('/api/auth/check', {
          credentials: 'include'
        });
        
        if (checkAuth.ok) {
          router.push('/console');
          // Force a refresh to ensure middleware picks up the new auth state
          router.refresh();
        } else {
          throw new Error('Authentication failed');
        }
      } else {
        setAlert({ type: 'error', message: data.error || 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setAlert({ type: 'error', message: 'Server error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4">
          <h1 className="mt-6 text-center text-3xl md:text-5xl font-extrabold text-teal-400 tracking-tight">
            Upcheck
          </h1>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-blue-400">
            Admin Dashboard
          </h2>
          <p className="text-center text-lg text-gray-500">
            Enter your credentials to access
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute top-3 left-3 text-gray-400 transition-colors duration-200 group-hover:text-blue-500" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  disabled={isLoading}
                  className="pl-10 w-full p-3 border rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="relative group">
                <Lock className="absolute top-3 left-3 text-gray-400 transition-colors duration-200 group-hover:text-blue-500" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={isLoading}
                  className="pl-10 w-full p-3 border rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>

      {alert && (
        <AlertMessage 
          type={alert.type} 
          message={alert.message} 
          onClose={() => setAlert(null)} 
        />
      )}
    </div>
  );
}