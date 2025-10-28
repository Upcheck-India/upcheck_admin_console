'use client';

import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';

export default function AssetsInventoryPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <UnauthorizedAccess />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Assets & Inventory</h1>
        <p className="text-gray-600 mb-6">Assets, assignments, warranty and check-in/out (coming soon)</p>

        <div className="rounded-lg border border-dashed p-8 text-center bg-white">
          <p className="text-gray-500">We will add asset registry, assignment to users, warranty dates and simple check-in/out workflows here.</p>
        </div>
      </div>
    </div>
  );
}
