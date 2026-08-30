'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', required: true, autoComplete: 'name' },
  { name: 'email', label: 'Email address', type: 'email', required: true, autoComplete: 'email' },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    required: true,
    autoComplete: 'new-password',
    hint: 'At least 8 characters.',
  },
  { name: 'company', label: 'Company', type: 'text' },
  { name: 'designation', label: 'Designation', type: 'text' },
  { name: 'mobileNumber', label: 'Mobile number', type: 'tel', autoComplete: 'tel' },
  { name: 'purpose', label: 'Purpose of access', type: 'text' },
];

export default function ExternalRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/dataroom/external-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      // The verification step has its own page — it owns the resend countdown
      // and the code entry, and it is reachable from the emailed link too.
      router.push(`/dataroom/external/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create External User Account</h1>
          <p className="text-slate-600">Register for limited access to Upcheck</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4"
        >
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {FIELDS.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="block text-sm font-medium text-slate-700 mb-1">
                {f.label}
                {!f.required && <span className="text-slate-400 font-normal"> (optional)</span>}
              </label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                required={f.required}
                autoComplete={f.autoComplete}
                minLength={f.name === 'password' ? 8 : undefined}
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
            </div>
          ))}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-600">
          <p>
            Already have an account?{' '}
            <Link
              href="/dataroom/external/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Login here
            </Link>
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <Link
            href="/dataroom/auth-gate"
            className="flex items-center justify-center text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login options
          </Link>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Security Information</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• New accounts are activated by an Upcheck administrator</li>
            <li>• Your session will remain active for 7 days</li>
            <li>• All activity is monitored and logged</li>
            <li>• You can only access documents and rooms you have been granted access to</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
