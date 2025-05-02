'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  Building2,
  Calendar,
  Mail,
  Bell,
  Key,
  Clock,
  ChevronLeft,
  Briefcase,
  Lock,
  CheckCircle2,
  MapPin,
  Link,
  Mail as AlternativeMail,
  FileText,
  Save,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import SecureLoading from "../../components/SecureLoading";

export default function ProfilePage() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // First check session
        const sessionRes = await fetch('/api/auth/session', {
          credentials: 'include'
        });
        const sessionData = await sessionRes.json();
        
        if (!sessionData.user) {
          router.push('/login');
          return;
        }

        // Then fetch complete profile data
        const profileRes = await fetch('/api/users/profile/get', {
          credentials: 'include'
        });

        if (!profileRes.ok) {
          throw new Error('Failed to fetch profile data');
        }

        const profileData = await profileRes.json();
        setUserData(profileData.user);
        setEditForm({
          bio: profileData.user.bio || '',
          location: profileData.user.location || '',
          alternativeEmail: profileData.user.alternativeEmail || '',
          linkedinProfile: profileData.user.linkedinProfile || ''
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const handleSaveProfile = async () => {
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setUserData(prev => ({
        ...prev,
        ...editForm
      }));
      setIsEditing(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userData.perms?.includes('users.manage')) {
      setError('Please contact an administrator to delete your account');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const response = await fetch('/api/users/profile', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      router.push('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to change password');
      }

      setSuccess('Password changed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setError('Failed to change password');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return <SecureLoading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/console')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group"
        >
          <ChevronLeft className="w-5 h-5 mr-1 transform group-hover:-translate-x-1 transition-transform" />
          Back to Console
        </button>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg flex items-center">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            {success}
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 px-6 py-8">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center">
                <span className="text-3xl font-bold text-blue-600">
                  {userData?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{userData?.username}</h1>
                <p className="text-blue-100">{userData?.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center text-gray-900">
                <User className="w-5 h-5 mr-2 text-blue-500" />
                Basic Information
              </h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Email</span>
                <span className="text-gray-900 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-blue-500" />
                  {userData?.email || 'No email added'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Department</span>
                <span className="text-gray-900 flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-blue-500" />
                  {userData?.department || 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Role</span>
                <span className="text-gray-900 flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                  {userData?.role}
                </span>
              </div>
              {isEditing ? (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea
                      value={editForm.bio || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value || null }))}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={editForm.location || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value || null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Email</label>
                    <input
                      type="email"
                      value={editForm.alternativeEmail || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, alternativeEmail: e.target.value || null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Backup email address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile</label>
                    <input
                      type="url"
                      value={editForm.linkedinProfile || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, linkedinProfile: e.target.value || null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </button>
                </div>
              ) : (
                <>
                  {userData?.bio && (
                    <div className="pt-4 border-t">
                      <span className="text-gray-600 flex items-center mb-2">
                        <FileText className="w-4 h-4 mr-2 text-blue-500" />
                        Bio
                      </span>
                      <p className="text-gray-900">{userData.bio}</p>
                    </div>
                  )}
                  {userData?.location && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Location</span>
                      <span className="text-gray-900 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                        {userData.location}
                      </span>
                    </div>
                  )}
                  {userData?.alternativeEmail && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Alternative Email</span>
                      <span className="text-gray-900 flex items-center">
                        <AlternativeMail className="w-4 h-4 mr-2 text-blue-500" />
                        {userData.alternativeEmail}
                      </span>
                    </div>
                  )}
                  {userData?.linkedinProfile && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">LinkedIn</span>
                      <a
                        href={userData.linkedinProfile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center"
                      >
                        <Link className="w-4 h-4 mr-2" />
                        View Profile
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900">
              <Shield className="w-5 h-5 mr-2 text-purple-500" />
              Permissions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {userData?.perms?.map((perm, index) => (
                <span
                  key={index}
                  className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm flex items-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {perm}
                </span>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900">
              <Clock className="w-5 h-5 mr-2 text-teal-500" />
              Activity
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Login</span>
                <span className="text-gray-900">
                  {userData?.lastLogin ? new Date(userData.lastLogin).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Notifications</span>
                <span className="flex items-center">
                  <Bell className="w-4 h-4 mr-2 text-teal-500" />
                  <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-sm">
                    {userData?.notifs || 0} unread
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900">
              <Lock className="w-5 h-5 mr-2 text-red-500" />
              Security
            </h2>
            <div className="space-y-4">
              <div className="text-gray-500 italic text-sm mb-4">
                Security features are currently unavailable. Please contact an administrator for any security-related changes.
              </div>
              <button
                disabled
                className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed flex items-center justify-center"
              >
                <Key className="w-4 h-4 mr-2" />
                Change Password
              </button>
              
              <button
                disabled
                className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Account</h3>
            <p className="text-gray-600 mb-4">
              {userData.perms?.includes('users.manage')
                ? 'Are you sure you want to delete your account? This action cannot be undone.'
                : 'Please contact an administrator to delete your account.'}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-700"
              >
                Cancel
              </button>
              {userData.perms?.includes('users.manage') && (
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}