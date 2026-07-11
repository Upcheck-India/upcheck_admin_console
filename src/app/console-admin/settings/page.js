'use client';
import { useState, useEffect } from 'react';
import { Cloud, Save, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const FEATURE_LABELS = {
  avatar: 'Profile avatars',
  chatMedia: 'Chat media (DM / Team / Group)',
  status: 'Status updates',
};

export default function MediaSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(false);
  const [statusSettings, setStatusSettings] = useState(null);
  const [retentionInput, setRetentionInput] = useState('24');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchStatusSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/media');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setCloudinaryConfigured(data.cloudinaryConfigured);
      }
    } catch (err) {
      console.error('Failed to load media settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusSettings = async () => {
    try {
      const res = await fetch('/api/settings/status');
      const data = await res.json();
      if (data.success) {
        setStatusSettings(data.settings);
        setRetentionInput(String(data.settings.retentionHours));
      }
    } catch (err) {
      console.error('Failed to load status settings:', err);
    }
  };

  const save = async (patch) => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch('/api/settings/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setMessage({ type: 'success', text: 'Saved' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      console.error('Failed to save media settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async (patch) => {
    try {
      setStatusSaving(true);
      setStatusMessage(null);
      const res = await fetch('/api/settings/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setStatusSettings(data.settings);
        setRetentionInput(String(data.settings.retentionHours));
        setStatusMessage({ type: 'success', text: 'Saved' });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      console.error('Failed to save status settings:', err);
      setStatusMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="p-6 text-red-600">Could not load settings.</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Status Updates</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Instagram/WhatsApp-style updates that disappear automatically. Turning this
        off hides the feature app-wide but does not delete existing updates early —
        they still expire and clean up on their normal schedule.
      </p>

      <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4 mb-4">
        <div>
          <div className="font-medium text-gray-900">Enable Status Updates</div>
          <div className="text-sm text-gray-500">Master switch for the whole feature</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!statusSettings?.statusEnabled}
            disabled={statusSaving || !statusSettings}
            onChange={(e) => saveStatus({ statusEnabled: e.target.checked })}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4 mb-6">
        <div>
          <div className="font-medium text-gray-900">Retention period</div>
          <div className="text-sm text-gray-500">Hours before an update auto-expires and is deleted (1-168)</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={168}
            className="w-20 border border-gray-300 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
            value={retentionInput}
            disabled={statusSaving || !statusSettings}
            onChange={(e) => setRetentionInput(e.target.value)}
            onBlur={() => {
              const hours = parseInt(retentionInput, 10);
              if (Number.isFinite(hours)) saveStatus({ retentionHours: hours });
            }}
          />
          <span className="text-sm text-gray-500">hours</span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mb-6 flex items-center gap-2 text-sm rounded-lg p-3 ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {statusMessage.text}
        </div>
      )}

      <hr className="my-8 border-gray-200" />

      <div className="flex items-center gap-2 mb-1">
        <Cloud size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Media Storage</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Control whether Cloudinary is used for image storage, or whether everything
        stays on the existing GridFS storage. Turning Cloudinary off instantly falls
        every feature back to GridFS, regardless of the per-feature choices below.
      </p>

      {!cloudinaryConfigured && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3 mb-6">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Cloudinary credentials aren&apos;t configured on this server (missing
            CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).
            Enabling it here will have no effect until those env vars are set,
            and every upload will keep using GridFS automatically.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4 mb-4">
        <div>
          <div className="font-medium text-gray-900">Enable Cloudinary</div>
          <div className="text-sm text-gray-500">Master switch for all Cloudinary-backed media features</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={settings.cloudinaryEnabled}
            disabled={saving}
            onChange={(e) => save({ cloudinaryEnabled: e.target.checked })}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      <div className="border border-gray-200 rounded-lg divide-y">
        {Object.entries(FEATURE_LABELS).map(([feature, label]) => (
          <div key={feature} className="flex items-center justify-between p-4">
            <div className="text-gray-900">{label}</div>
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
              value={settings.providers?.[feature] || 'gridfs'}
              disabled={saving || !settings.cloudinaryEnabled}
              onChange={(e) =>
                save({ providers: { ...settings.providers, [feature]: e.target.value } })
              }
            >
              <option value="gridfs">GridFS (default)</option>
              <option value="cloudinary">Cloudinary</option>
            </select>
          </div>
        ))}
      </div>

      {message && (
        <div
          className={`mt-4 flex items-center gap-2 text-sm rounded-lg p-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {saving && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Save size={14} className="animate-pulse" /> Saving...
        </div>
      )}
    </div>
  );
}
