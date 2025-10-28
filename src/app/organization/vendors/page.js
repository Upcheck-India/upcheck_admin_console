'use client';

import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';

export default function VendorsContractsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendors & Contracts</h1>
        <p className="text-gray-600 mb-6">Vendor registry, contracts, renewals and cost centers (coming soon)</p>

        <div className="rounded-lg border border-dashed p-8 text-center bg-white">
          <p className="text-gray-500">We will add vendor registry, contract tracking, renewals and cost-center mapping here.</p>
        </div>
      </div>
    </div>
  );
}
