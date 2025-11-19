'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import UnauthorizedAccess from '../../../components/UnauthorizedAccess';
import { Target, TrendingUp, ArrowLeft, AlertCircle } from 'lucide-react';
import useBillingAccount from '../funds/_hooks/useBillingAccount';
import AccountSelector from '../funds/_components/AccountSelector';
import GrantApplications from './_components/GrantApplications';
import BudgetPlanningEnhanced from './_components/BudgetPlanningEnhanced';

export default function PlanningBudgetsPage() {
  const { user, isLoading: authLoading } = useAuth(true);
  const isAdmin = user && (user.role === 'Admin' || user.role === 'Console admin');
  const { accounts, activeAccountId, activeAccount, selectAccount, addAccount } = useBillingAccount();
  
  const [activeTab, setActiveTab] = useState('planning'); // 'planning' | 'budgeting'

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-14 w-14 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 h-14 w-14 border-3 border-indigo-200 rounded-full animate-pulse" />
          </div>
          <p className="mt-6 text-slate-600 font-medium">Loading planning & budgets...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <UnauthorizedAccess />;
  }

  const noAccount = !activeAccountId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/organization/finance"
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                title="Back to Finance"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 p-2 rounded-xl shadow-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 bg-clip-text text-transparent">
                    Planning & Budgets
                  </span>
                  <div className="h-0.5 bg-gradient-to-r from-teal-600 to-green-600 rounded-full mt-0.5" />
                </div>
              </div>
            </div>

            {/* Account Selector */}
            <div className="flex items-center gap-2">
              <AccountSelector
                accounts={accounts}
                activeAccountId={activeAccountId || ''}
                onSelect={(id) => selectAccount(id)}
                onAdd={(name) => addAccount(name)}
              />
              <Link href="/organization/finance/accounts" className="px-2 py-1.5 text-xs rounded-lg border bg-white hover:bg-slate-50 text-slate-700">
                Manage
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="h-8 w-1 bg-gradient-to-b from-teal-600 to-green-600 rounded-full" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 bg-clip-text text-transparent">
              Planning & Budgets
            </h1>
            {!!activeAccount && (
              <span className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                Account: <span className="font-semibold">{activeAccount.name}</span>
              </span>
            )}
          </div>
          <p className="text-slate-600 ml-3">Track grant applications and plan budgets effectively</p>
        </div>

        {/* No Account Warning */}
        {noAccount && (
          <div className="mb-8 bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Select a billing account
              </h3>
              <p className="text-slate-600">Create or select an account to manage grant applications and budgets.</p>
            </div>
            <Link href="/organization/finance/accounts" className="px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700">
              Go to Accounts
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('planning')}
            className={`px-4 py-2 border-b-2 transition-all ${
              activeTab === 'planning'
                ? 'border-teal-600 text-teal-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-teal-600'
            } flex items-center gap-2`}
          >
            <TrendingUp className="w-4 h-4" />
            Planning (Grant Applications)
          </button>
          <button
            onClick={() => setActiveTab('budgeting')}
            className={`px-4 py-2 border-b-2 transition-all ${
              activeTab === 'budgeting'
                ? 'border-emerald-600 text-emerald-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-emerald-600'
            } flex items-center gap-2`}
          >
            <Target className="w-4 h-4" />
            Budgeting
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'planning' && (
          <GrantApplications accountId={activeAccountId} disabled={noAccount} />
        )}
        {activeTab === 'budgeting' && (
          <BudgetPlanningEnhanced accountId={activeAccountId} disabled={noAccount} />
        )}
      </div>
    </div>
  );
}
