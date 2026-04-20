'use client';

import { useRouter } from 'next/navigation';
import { Shield, Users, UserCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DataRoomAuthGate() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Welcome to Data Room</h1>
          <p className="text-lg text-slate-600">Secure document management and virtual data room platform</p>
        </div>

        {/* Auth Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcheck Staff Login */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 hover:border-blue-500 transition-all p-8 group cursor-pointer"
               onClick={() => router.push('/login')}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                <UserCheck className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Upcheck Staff</h2>
              <p className="text-slate-600 mb-6">
                Login with your @upcheck.* email to access the admin dashboard and manage data rooms.
              </p>
              <div className="flex items-center text-blue-600 font-semibold group-hover:text-blue-700">
                <span>Staff Login</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* External User Login */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 hover:border-green-500 transition-all p-8 group cursor-pointer"
               onClick={() => router.push('/dataroom/external/login')}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-600 transition-colors">
                <Users className="w-8 h-8 text-green-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">External User</h2>
              <p className="text-slate-600 mb-6">
                Access shared documents and data rooms. Register or login with your external account.
              </p>
              <div className="flex items-center text-green-600 font-semibold group-hover:text-green-700">
                <span>External Login</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <div className="bg-white/50 backdrop-blur rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">🔒 Secure Access</h3>
            <p className="text-sm text-slate-600">Bank-level encryption and security monitoring</p>
          </div>
          <div className="bg-white/50 backdrop-blur rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">📊 Full Tracking</h3>
            <p className="text-sm text-slate-600">Complete audit trail of all activities</p>
          </div>
          <div className="bg-white/50 backdrop-blur rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">⏱️ 7-Day Sessions</h3>
            <p className="text-sm text-slate-600">External users get secure week-long access</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>By accessing this system, you agree to our security policies and monitoring practices.</p>
          <p className="mt-2">All unauthorized access attempts will be logged and reported.</p>
        </div>
      </div>
    </div>
  );
}
