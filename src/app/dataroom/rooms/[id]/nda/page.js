'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, FileSignature, CheckCircle, Shield } from 'lucide-react';

export default function NDAPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;

  const [room, setRoom] = useState(null);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState('');

  useEffect(() => {
    fetchRoom();
    checkSignature();
  }, []);

  async function fetchRoom() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoom(data);
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
    }
  }

  async function checkSignature() {
    try {
      const response = await fetch(`/api/dataroom/signatures?roomId=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setSigned(data.signatures && data.signatures.length > 0);
      }
    } catch (error) {
      console.error('Failed to check signature:', error);
    }
  }

  async function handleSign() {
    if (!signature.trim()) {
      alert('Please enter your full name');
      return;
    }

    setSigning(true);
    try {
      const response = await fetch('/api/dataroom/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          documentType: 'NDA',
          signatureText: signature,
          agreedToTerms: true,
        }),
      });

      if (response.ok) {
        setSigned(true);
        setTimeout(() => router.push(`/dataroom/rooms/${roomId}`), 2000);
      }
    } catch (error) {
      console.error('Failed to sign NDA:', error);
    } finally {
      setSigning(false);
    }
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-12 max-w-md text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">NDA Signed Successfully</h2>
          <p className="text-slate-600 mb-6">You can now access the data room</p>
          <button
            onClick={() => router.push(`/dataroom/rooms/${roomId}`)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Enter Data Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/dataroom')} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Non-Disclosure Agreement</h1>
              <p className="text-sm text-slate-500">{room?.name || 'Data Room'}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-10 h-10 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Confidentiality Agreement</h2>
              <p className="text-slate-600">Please read and sign to access this data room</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
            <h3 className="font-bold text-slate-900 mb-3">Terms & Conditions</h3>
            <div className="text-sm text-slate-700 space-y-3">
              <p>By signing this agreement, you acknowledge that:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All information in this data room is confidential and proprietary</li>
                <li>You will not share, copy, or distribute any documents without authorization</li>
                <li>You will use the information solely for the intended business purpose</li>
                <li>You will return or destroy all materials upon request</li>
                <li>Unauthorized disclosure may result in legal action</li>
                <li>This agreement remains in effect for 2 years from the date of signing</li>
              </ul>
              <p className="mt-4">All access and activity in this data room is monitored and logged.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Electronic Signature (Type your full name)
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-signature"
                style={{ fontFamily: 'cursive' }}
              />
            </div>

            <div className="flex items-start space-x-2">
              <input type="checkbox" id="agree" className="mt-1" required />
              <label htmlFor="agree" className="text-sm text-slate-600">
                I have read and agree to the terms of this Non-Disclosure Agreement. I understand that my signature is legally binding.
              </label>
            </div>

            <button
              onClick={handleSign}
              disabled={signing || !signature.trim()}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {signing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-5 h-5" />
                  <span>Sign NDA</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-6">
            Signed on: {new Date().toLocaleDateString()} | IP Address will be recorded
          </p>
        </div>
      </div>
    </div>
  );
}
