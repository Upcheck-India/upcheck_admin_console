'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import SecureLoading from '../../../../components/SecureLoading';
import { ArrowLeft, Save, Palette } from 'lucide-react';

export default function RoomSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [room, setRoom] = useState(null);
  const [settings, setSettings] = useState({
    allowDownload: true,
    allowPrint: false,
    requireNDA: false,
    watermarkEnabled: true,
    expiryDate: '',
    autoLock: false,
    maxStorageGB: 10
  });
  const [branding, setBranding] = useState({
    logoUrl: '',
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    headerText: '',
    footerText: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoom();
    fetchBranding();
  }, [roomId]);

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  async function fetchRoom() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoom(data);
        if (data.settings) {
          setSettings({ ...settings, ...data.settings });
        }
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
    }
  }

  async function fetchBranding() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}/branding`);
      if (response.ok) {
        const data = await response.json();
        if (data.branding) {
          setBranding({ ...branding, ...data.branding });
        }
      }
    } catch (error) {
      console.error('Failed to fetch branding:', error);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        alert('Settings saved successfully');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBranding() {
    setSaving(true);
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });

      if (response.ok) {
        alert('Branding saved successfully');
      }
    } catch (error) {
      console.error('Failed to save branding:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push(`/dataroom/rooms/${roomId}`)} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Room Settings</h1>
              <p className="text-sm text-slate-500">{room?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* General Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Storage Quota (GB)</label>
              <input
                type="number"
                value={settings.maxStorageGB}
                onChange={(e) => setSettings({...settings, maxStorageGB: parseInt(e.target.value) || 10})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
              <input
                type="date"
                value={settings.expiryDate}
                onChange={(e) => setSettings({...settings, expiryDate: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Auto-lock on expiry</p>
                <p className="text-sm text-slate-500">Automatically lock room after expiry</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoLock}
                  onChange={(e) => setSettings({...settings, autoLock: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Security Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Allow Downloads</p>
                <p className="text-sm text-slate-500">Users can download documents</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowDownload}
                  onChange={(e) => setSettings({...settings, allowDownload: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Allow Printing</p>
                <p className="text-sm text-slate-500">Users can print documents</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowPrint}
                  onChange={(e) => setSettings({...settings, allowPrint: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Require NDA</p>
                <p className="text-sm text-slate-500">Users must sign NDA before access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireNDA}
                  onChange={(e) => setSettings({...settings, requireNDA: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Enable Watermarks</p>
                <p className="text-sm text-slate-500">Add user watermarks to documents</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.watermarkEnabled}
                  onChange={(e) => setSettings({...settings, watermarkEnabled: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={saving} className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2">
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Palette className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Room Branding</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Logo URL</label>
              <input
                type="url"
                value={branding.logoUrl}
                onChange={(e) => setBranding({...branding, logoUrl: e.target.value})}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Primary Color</label>
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({...branding, primaryColor: e.target.value})}
                  className="w-full h-10 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Secondary Color</label>
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({...branding, secondaryColor: e.target.value})}
                  className="w-full h-10 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Header Text</label>
              <input
                type="text"
                value={branding.headerText}
                onChange={(e) => setBranding({...branding, headerText: e.target.value})}
                placeholder="Custom header text"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Footer Text</label>
              <input
                type="text"
                value={branding.footerText}
                onChange={(e) => setBranding({...branding, footerText: e.target.value})}
                placeholder="Custom footer text"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <button onClick={handleSaveBranding} disabled={saving} className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2">
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save Branding'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
