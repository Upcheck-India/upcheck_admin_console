'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { debounce } from 'lodash';
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
  Link as LinkIcon,
  Mail as AlternativeMail,
  FileText,
  Save,
  AlertTriangle,
  Trash2,
  Github,
  Unlink,
  Link,
  ExternalLink,
  Search,
  Star,
  GitFork,
  Plus,
  Loader2,
  Users,
  Code
} from 'lucide-react';
import SecureLoading from "../../components/SecureLoading";
import { FaGoogle } from "react-icons/fa";

export default function ProfilePage() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: '',
    location: '',
    alternateEmail: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [githubRepos, setGithubRepos] = useState([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoSearchTerm, setRepoSearchTerm] = useState('');
  const [showAllRepos, setShowAllRepos] = useState(false);
  const router = useRouter();

  // OAuth provider configuration
  const oauthProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: () => (
        <div className="w-5 h-5 rounded flex items-center justify-center">
          <FaGoogle />
        </div>
      ),
      color: 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200',
      connectEndpoint: '/api/auth/google/connect',
      disconnectEndpoint: '/api/auth/google/disconnect',
      hasAdditionalInfo: false,
      isRestricted: true
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: Github,
      color: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      connectEndpoint: '/api/auth/github/connect',
      disconnectEndpoint: '/api/auth/github/disconnect',
      hasAdditionalInfo: true,
      isRestricted: false
    },
    {
      id: 'reddit',
      name: 'Reddit',
      icon: () => (
        <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">r</span>
        </div>
      ),
      color: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
      connectEndpoint: '/api/auth/reddit/connect',
      disconnectEndpoint: '/api/auth/reddit/disconnect',
      hasAdditionalInfo: false,
      isRestricted: true
    },
    {
      id: 'vercel',
      name: 'Vercel',
      icon: () => (
        <div className="w-5 h-5 bg-black rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">▲</span>
        </div>
      ),
      color: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      connectEndpoint: '/api/auth/vercel/connect',
      disconnectEndpoint: '/api/auth/vercel/disconnect',
      hasAdditionalInfo: false,
      isRestricted: true
    }
  ];

  const fetchConnectedAccounts = async () => {
    console.log('Fetching connected accounts...');
    try {
      const [res, userRes] = await Promise.all([
        fetch('/api/auth/connected-accounts', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch('/api/users/profile/get', { 
          credentials: 'include',
          cache: 'no-store'
        })
      ]);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch connected accounts');
      }

      const data = await res.json();
      console.log('Connected accounts from API:', data.connectedAccounts);
      
      // Get user data to check OAuth connections
      let userOAuth = {};
      if (userRes.ok) {
        const userData = await userRes.json();
        userOAuth = userData.user?.oauth || {};
        console.log('User OAuth data:', userOAuth);
      }
      
      // Check which OAuth providers are connected
      const connected = [];
      if (userOAuth.github) connected.push('github');
      if (userOAuth.google) connected.push('google');
      
      // Combine with any other connected accounts from the API
      const allAccounts = [...new Set([
        ...(data.connectedAccounts || []),
        ...connected
      ])];
      
      console.log('All connected accounts:', allAccounts);
      setConnectedAccounts(allAccounts);
      
      // If GitHub is connected, fetch repositories
      if (allAccounts.includes('github')) {
        console.log('GitHub is connected, fetching repositories...');
        await fetchGithubRepos();
      } else {
        console.log('GitHub is not connected');
        setGithubRepos([]);
      }
      
      return allAccounts;
      
    } catch (error) {
      console.error('Error in fetchConnectedAccounts:', error);
      toast.error(`Failed to load connected accounts: ${error.message}`);
      return [];
    }
  };
  
  const fetchGithubRepos = async (searchTerm = '') => {
    console.log('fetchGithubRepos called with searchTerm:', searchTerm);
    
    try {
      // First, verify we have a valid session and user data
      const [sessionRes, userRes] = await Promise.all([
        fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store'
        }),
        fetch('/api/users/profile/get', {
          credentials: 'include',
          cache: 'no-store'
        })
      ]);
      
      if (!sessionRes.ok) {
        console.error('Failed to verify session');
        throw new Error('Session verification failed');
      }
      
      const sessionData = await sessionRes.json();
      console.log('Session data:', sessionData);
      
      let userData = {};
      if (userRes.ok) {
        userData = await userRes.json();
        console.log('User data in fetchGithubRepos:', userData);
      }
      
      // Check if GitHub is connected in the user data
      const isGithubConnected = userData?.user?.oauth?.github || 
                              userData?.user?.connectedAccounts?.includes('github');
      
      if (!isGithubConnected) {
        console.log('GitHub not connected in user data, skipping fetch');
        setGithubRepos([]);
        return;
      }
      
      setIsLoadingRepos(true);
      
      // Get the GitHub username from OAuth data or user data
      const githubUsername = userData?.user?.oauth?.github?.login || 
                           userData?.user?.githubUsername;
      
      if (!githubUsername) {
        console.error('No GitHub username found in user data');
        throw new Error('GitHub username not found');
      }
      
      console.log('Fetching GitHub repos for user:', githubUsername);
      
      // Build the API URL
      let apiUrl = '/api/github/repos';
      const params = new URLSearchParams();
      
      if (searchTerm) {
        params.append('q', searchTerm);
      }
      
      if (params.toString()) {
        apiUrl += `?${params.toString()}`;
      }
      
      console.log('Making request to:', apiUrl);
      
      // Fetch the repositories
      const res = await fetch(apiUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('GitHub API response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('GitHub API error:', errorData);
        
        if (res.status === 401) {
          // Token might be expired or invalid
          toast.error('GitHub session expired. Please reconnect your GitHub account.');
          // Update connected accounts to reflect the disconnection
          setConnectedAccounts(prev => prev.filter(acc => acc !== 'github'));
        }
        
        throw new Error(errorData.error || 'Failed to fetch repositories');
      }
      
      const data = await res.json();
      console.log('GitHub repos received:', data.repositories?.length || 0, 'repositories');
      
      // Update the repositories state
      setGithubRepos(data.repositories || []);
      
      if (!data.repositories || data.repositories.length === 0) {
        console.log('No repositories found for user:', githubUsername);
        
        // If we have a search term and no results, show a message
        if (searchTerm) {
          toast('No repositories found matching your search');
        } else {
          toast('No repositories found for your GitHub account');
        }
      }
      
    } catch (error) {
      console.error('Error in fetchGithubRepos:', error);
      
      // Only show error toast if it's not a 404 (no repos)
      if (!error.message.includes('404')) {
        toast.error(`Failed to load repositories: ${error.message}`);
      }
      
      setGithubRepos([]);
    } finally {
      setIsLoadingRepos(false);
    }
  };
  
  // Debounced search for repositories
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      fetchGithubRepos(searchTerm);
    }, 500),
    []
  );
  
  const handleRepoSearch = (e) => {
    const searchTerm = e.target.value;
    setRepoSearchTerm(searchTerm);
    debouncedSearch(searchTerm);
  };

  // Check URL for success/error messages
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      
      if (searchParams.has('success') && searchParams.get('success') === 'github_connected') {
        try {
          // Show loading state
          setIsConnecting(true);
          
          // Remove the success parameter from URL
          const newUrl = new URL(window.location);
          newUrl.searchParams.delete('success');
          window.history.replaceState({}, '', newUrl);
          
          // Show success message
          toast.success('Successfully connected GitHub account');
          
          // Refresh user data and connected accounts
          const [profileRes] = await Promise.all([
            fetch('/api/users/profile/get', { 
              credentials: 'include',
              cache: 'no-store' 
            })
          ]);
          
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUserData(profileData.user);
          }
          
          // Refresh connected accounts and repositories
          await fetchConnectedAccounts();
          
        } catch (error) {
          console.error('Error handling GitHub connection:', error);
          toast.error(`Failed to complete GitHub connection: ${error.message}`);
        } finally {
          setIsConnecting(false);
        }
        
      } else if (searchParams.has('error')) {
        const error = searchParams.get('error');
        toast.error(`GitHub connection failed: ${error}`);
        
        // Remove the error parameter from URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl);
      }
    };
    
    handleOAuthCallback();
  }, []);

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

        // Then fetch complete profile data and connected accounts in parallel
        const [profileRes, connectedAccountsRes] = await Promise.all([
          fetch('/api/users/profile/get', { credentials: 'include' }),
          fetchConnectedAccounts()
        ]);

        if (!profileRes.ok) {
          throw new Error('Failed to fetch profile data');
        }

        const profileData = await profileRes.json();
        setUserData(profileData.user);
        setEditForm({
          username: profileData.user.username || '',
          email: profileData.user.email || '',
          firstName: profileData.user.firstName || '',
          lastName: profileData.user.lastName || '',
          bio: profileData.user.bio || '',
          phone: profileData.user.phone || '',
          location: profileData.user.location || '',
          alternateEmail: profileData.user.alternateEmail || '',
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

  const handleOAuthConnection = async (provider, action = 'connect') => {
    if (provider.isRestricted && action === 'connect') {
      toast.error(`${provider.name} integration is currently restricted`);
      return;
    }

    try {
      setIsConnecting(true);
      const endpoint = action === 'connect' 
        ? provider.connectEndpoint 
        : provider.disconnectEndpoint;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          redirect: `${window.location.origin}${window.location.pathname}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} ${provider.name}`);
      }

      const data = await response.json();
      
      if (data.redirect) {
        // For OAuth flow, redirect to provider
        window.location.href = data.redirect;
      } else {
        // For disconnect, refresh the connected accounts
        await fetchConnectedAccounts();
        toast.success(`${provider.name} account ${action === 'connect' ? 'connected' : 'disconnected'} successfully`);
      }
    } catch (error) {
      console.error(`Error ${action}ing ${provider.name}:`, error);
      toast.error(`Failed to ${action} ${provider.name}`);
    } finally {
      setIsConnecting(false);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneChange = (e) => {
    // Format phone number as user types
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    let formattedValue = '';
    
    if (value.length > 3 && value.length <= 6) {
      formattedValue = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    } else if (value.length > 6) {
      formattedValue = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
    } else {
      formattedValue = value;
    }
    
    setEditForm(prev => ({
      ...prev,
      phone: formattedValue
    }));
  };

  const filteredRepos = githubRepos.filter(repo =>
    repo.name.toLowerCase().includes(repoSearchTerm.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(repoSearchTerm.toLowerCase()))
  );

  const displayedRepos = showAllRepos ? filteredRepos : filteredRepos.slice(0, 6);

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
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={editForm.firstName}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={editForm.lastName}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Alternate Email</label>
                    <input
                      type="email"
                      name="alternateEmail"
                      value={editForm.alternateEmail}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">+1</span>
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={editForm.phone}
                        onChange={handlePhoneChange}
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-12 sm:text-sm border-gray-300 rounded-md"
                        placeholder="(123) 456-7890"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={editForm.location}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="City, Country"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={editForm.bio || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about yourself..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile</label>
                  <input
                    type="url"
                    name="linkedinProfile"
                    value={editForm.linkedinProfile || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
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
                {userData?.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Phone</span>
                    <span className="text-gray-900">{userData.phone}</span>
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
                {userData?.bio && (
                  <div className="pt-2">
                    <span className="text-gray-600 block mb-1">Bio</span>
                    <p className="text-gray-900">{userData.bio}</p>
                  </div>
                )}
                {userData?.linkedinProfile && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">LinkedIn</span>
                    <a
                      href={userData.linkedinProfile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      <LinkIcon className="w-4 h-4 mr-1" />
                      View Profile
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900">
              <Bell className="w-5 h-5 mr-2 text-blue-500" />
              Notifications
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Email Notifications</span>
                <span className="flex items-center">
                  <Bell className="w-4 h-4 mr-2 text-teal-500" />
                  <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-sm">
                    {userData?.notifs || 0} unread
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Accounts Section */}
        <div className="mt-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900">
              <Users className="w-5 h-5 mr-2 text-purple-500" />
              Connected Accounts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {oauthProviders.map((provider) => {
                const isConnected = connectedAccounts.includes(provider.id);
                const IconComponent = provider.icon;
                
                return (
                  <div
                    key={provider.id}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      isConnected 
                        ? 'border-green-200 bg-green-50' 
                        : provider.isRestricted 
                          ? 'border-gray-200 bg-gray-50 opacity-60' 
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${provider.color}`}>
                          <IconComponent />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{provider.name}</h3>
                          <p className="text-sm text-gray-500">
                            {isConnected ? 'Connected' : 
                             provider.isRestricted ? 'Currently restricted' : 'Not connected'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {isConnected && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                        {provider.isRestricted && !isConnected && (
                          <Lock className="w-4 h-4 text-gray-400" />
                        )}
                        <button
                          onClick={() => handleOAuthConnection(provider, isConnected ? 'disconnect' : 'connect')}
                          disabled={isConnecting || (provider.isRestricted && !isConnected)}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            isConnected
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : provider.isRestricted
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {isConnecting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isConnected ? (
                            'Disconnect'
                          ) : provider.isRestricted ? (
                            'Unavailable'
                          ) : (
                            'Connect'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* GitHub Repositories Section */}
        {connectedAccounts.includes('github') && (
          <div className="mt-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center text-gray-900">
                  <Code className="w-5 h-5 mr-2 text-gray-700" />
                  GitHub Repositories
                </h2>
                <a
                  href={`https://github.com/${userData?.oauth?.github?.login || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                  onClick={(e) => {
                    if (!userData?.oauth?.github?.login) {
                      e.preventDefault();
                      toast.error('GitHub username not available');
                    }
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View GitHub Profile
                </a>
              </div>
              
              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={repoSearchTerm}
                  onChange={handleRepoSearch}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Repositories Grid */}
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading repositories...</span>
                </div>
              ) : displayedRepos.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedRepos.map((repo) => (
                      <div key={repo.id} className="group">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow hover:border-blue-200 h-full"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 group-hover:text-blue-600 flex items-center">
                                {repo.name}
                                <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </h3>
                              {repo.description && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {repo.description}
                                </p>
                              )}
                            </div>
                            {repo.private && (
                              <Lock className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-gray-500 mt-3">
                            <div className="flex items-center space-x-4">
                              {repo.language && (
                                <div className="flex items-center">
                                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
                                  <span>{repo.language}</span>
                                </div>
                              )}
                              <div className="flex items-center">
                                <Star className="w-3 h-3 mr-1" />
                                <span>{repo.stars || 0}</span>
                              </div>
                              <div className="flex items-center">
                                <GitFork className="w-3 h-3 mr-1" />
                                <span>{repo.forks || 0}</span>
                              </div>
                            </div>
                            <span 
                              className="text-xs text-gray-400" 
                              title={repo.updatedAt ? new Date(repo.updatedAt).toLocaleString() : 'No update date'}
                            >
                              {repo.updatedAt ? `Updated ${formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}` : ''}
                            </span>
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                  
                  {filteredRepos.length > 6 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAllRepos(!showAllRepos)}
                        className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showAllRepos ? 'Show Less' : `Show All ${filteredRepos.length} Repositories`}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {repoSearchTerm ? 'No repositories found matching your search.' : 'No repositories found.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Section */}
        <div className="mt-6">
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
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center"
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
              {userData?.perms?.includes('users.manage')
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
              {userData?.perms?.includes('users.manage') && (
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