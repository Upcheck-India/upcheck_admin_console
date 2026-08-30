//src/app/page.js (rootpage)
// src/app/page.js
'use client';

import { useAuth } from '../hooks/useAuth';
import Login from "./login/page";
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isLoading } = useAuth(false); // false because this is a public route

  // An external user landing here is redirected to their portal by the
  // middleware, which can read the httpOnly session cookie this page cannot.

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <Login />;
}