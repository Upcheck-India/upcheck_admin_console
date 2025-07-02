'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Link as LinkIcon,
  ChevronLeft,
  Briefcase,
  Calendar,
  Clock,
  Lock,
  Shield,
  AlertCircle,
  RefreshCw,
  UserX,
  CheckCircle2,
  XCircle,
  AlertCircle as AlertIcon,
  Github,
  Google,
  Link2,
  Unlink,
  Link
} from 'lucide-react';

// Simple loading spinner component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// OAuth provider configuration
const oauthProviders = [
  {
    id: 'google',
    name: 'Google',
    icon: Google,
    color: 'bg-red-100 text-red-600',
    connectEndpoint: '/api/auth/google/connect',
    disconnectEndpoint: '/api/auth/google/disconnect'
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    color: 'bg-gray-100 text-gray-800',
    connectEndpoint: '/api/auth/github/connect',
    disconnectEndpoint: '/api/auth/github/disconnect'
  },
  // Add more providers as needed
];

export default function UserProfilePage() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/${id}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch user data');
        }

        const data = await response.json();
        setUserData(data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError(error.message || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchUserProfile();
    } else {
      setError('No user ID provided');
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center py-12">
              <UserX className="mx-auto h-12 w-12 text-gray-400" />
              <h2 className="mt-4 text-xl font-medium text-gray-900">User Not Found</h2>
              <p className="mt-2 text-gray-600">The requested user could not be found.</p>
              <div className="mt-6">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to User Management
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No actions needed for public profile view

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unavailable';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Unavailable';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    const statusValue = status?.toLowerCase() || 'active'; // Default to active if not set
    switch (statusValue) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

    // Get status display text
  const getStatusDisplay = (status) => {
    if (!status) return 'Active'; // Default to Active if not set
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  // Format permissions for display
  const formatPermission = (permission) => {
    // Convert snake_case to Title Case
    return permission
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' > ');
  };

  // Group permissions by category
  const groupPermissions = (permissions) => {
    if (!permissions || !Array.isArray(permissions)) return {};
    
    return permissions.reduce((groups, permission) => {
      const [category] = permission.split('.');
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(permission);
      return groups;
    }, {});
  };

  // Use perms array from userData if available, otherwise fall back to permissions
  const userPermissions = userData?.perms || userData?.permissions || [];
  const permissionGroups = groupPermissions(userPermissions);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => router.back()}
                  className="mr-4 p-1.5 rounded-lg bg-white shadow-sm hover:bg-gray-50 transition-colors duration-200"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">User Profile</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage user account and settings
                  </p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <span className="text-sm text-gray-500">Viewing Public Profile</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="px-6 py-6 sm:px-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Column - Profile Info */}
              <div className="lg:w-1/3">
                {/* Profile Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4 overflow-hidden">
                        {userData.avatar ? (
                          <img 
                            src={userData.avatar} 
                            alt={`${userData.firstName} ${userData.lastName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-16 w-16 text-blue-600" />
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md">
                          <div className={`h-3.5 w-3.5 rounded-full ${userData.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        </div>
                      </div>
                      
                      <h1 className="text-2xl font-bold text-center text-gray-900">
                        {userData.firstName || userData.lastName
                          ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                          : userData.username}
                      </h1>
                      <p className="text-gray-600 text-center">{userData.email}</p>
                      
                      {userData.role && (
                        <div className="mt-2 flex justify-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {userData.role}
                          </span>
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(userData.status)}`}>
                          {getStatusDisplay(userData.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Connected Accounts - Read Only */}
                {/* Connected Accounts - Social Profiles */}
                {(userData.connectedAccounts?.length > 0 || userData.oauth) && (
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">SOCIAL PROFILES</h3>
                    <div className="space-y-3">
                      {/* GitHub Profile */}
                      {userData.connectedAccounts?.includes('github') && (userData.oauth?.github?.login || userData.githubUsername) && (
                        <a 
                          href={`https://github.com/${userData.oauth?.github?.login || userData.githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                        >
                          <div className="p-2 rounded-lg bg-gray-100 bg-opacity-30">
                            <Github className="h-5 w-5 text-gray-800" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-700">GitHub Profile</p>
                            <p className="text-xs text-gray-500">View on GitHub</p>
                          </div>
                        </a>
                      )}

                      {/* Google Profile */}
                      {/* Google Profile */}
                      {userData.connectedAccounts?.includes('google') && (userData.oauth?.google?.email || userData.email) && (
                        <a 
                          href={`https://myaccount.google.com/profile`}
                          onClick={(e) => {
                            if (!userData.oauth?.google?.email && !userData.email) {
                              e.preventDefault();
                              toast.error('No Google email found');
                            }
                          }}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                        >
                          <div className="p-2 rounded-lg bg-red-100 bg-opacity-30">
                            <Google className="h-5 w-5 text-red-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-700">Google Account</p>
                            <p className="text-xs text-gray-500">View Google Profile</p>
                          </div>
                        </a>
                      )}

                      {/* Other connected accounts without OAuth data */}
                      {userData.connectedAccounts?.map(providerId => {
                        // Skip already displayed providers
                        if (['github', 'google'].includes(providerId)) return null;
                        
                        const provider = oauthProviders.find(p => p.id === providerId);
                        if (!provider) return null;
                        
                        return (
                          <div key={provider.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                            <div className={`p-2 rounded-lg ${provider.color} bg-opacity-30`}>
                              <provider.icon className="h-5 w-5" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-700">{provider.name}</p>
                              <p className="text-xs text-gray-500">Connected</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>
                
                {/* Account Status - Read Only */}
                <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">ACCOUNT STATUS</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Account Status</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(userData.status)}`}>
                        {getStatusDisplay(userData.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Account Created</span>
                      <span className="text-sm text-gray-600">{formatDate(userData.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Last Active</span>
                      <span className="text-sm text-gray-600">{formatDate(userData.lastLogin)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - User Details */}
              <div className="lg:w-2/3">
                {/* Account Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Account Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Account ID</h4>
                      <p className="text-sm text-gray-900 break-all">{userData._id || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Username</h4>
                      <p className="text-sm text-gray-900">{userData.username || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">User Type</h4>
                      <p className="text-sm text-gray-900">{userData.userType || 'Standard'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Email Verified</h4>
                      <p className="text-sm">
                        {userData.emailVerified ? (
                          <span className="inline-flex items-center text-green-600">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-yellow-600">
                            <AlertIcon className="h-4 w-4 mr-1" /> Not Verified
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 my-6"></div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Contact Information</h4>

                  {/* Contact Information Content */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Email</p>
                          <p className="text-sm text-gray-900">{userData.email || 'Not provided'}</p>
                        </div>
                      </div>

                      {userData.alternateEmail && (
                        <div className="flex items-start">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Alternate Email</p>
                            <p className="text-sm text-gray-900">{userData.alternateEmail}</p>
                          </div>
                        </div>
                      )}

                      {userData.phone && (
                        <div className="flex items-start">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Phone</p>
                            <p className="text-sm text-gray-900">{userData.phone}</p>
                          </div>
                        </div>
                      )}

                      {userData.location && (
                        <div className="flex items-start">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Location</p>
                            <p className="text-sm text-gray-900">{userData.location}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              </div>
              
              {/* Additional Sections */}
              <div className="lg:col-span-2 space-y-6">
                {/* LinkedIn Profile */}
                {userData.linkedinProfile && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Social Profiles</h3>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <LinkIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">LinkedIn</p>
                        <a
                          href={userData.linkedinProfile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View Profile
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bio */}
                    {userData.bio && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Bio</h4>
                        <p className="text-gray-700 text-sm">{userData.bio}</p>
                      </div>
                    )}
                    
                    {/* Department */}
                    {userData.department && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Department</h4>
                        <p className="text-gray-700 text-sm">{userData.department}</p>
                      </div>
                    )}
                    
                    {/* Timezone */}
                    {userData.timezone && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Timezone</h4>
                        <p className="text-gray-700 text-sm">{userData.timezone}</p>
                      </div>
                    )}
                    
                    {/* Last IP Address */}
                    {userData.lastIpAddress && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Last IP Address</h4>
                        <p className="text-gray-700 text-sm font-mono">{userData.lastIpAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
                    <span className="text-sm text-gray-500">
                      {userPermissions.length} permission{userPermissions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {userPermissions.length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(permissionGroups).map(([category, perms]) => (
                        <div key={category}>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                            {category.replace(/\./g, ' ')}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {perms.map((permission, index) => (
                              <span 
                                key={index}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                                title={permission}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                {permission.split('.').slice(1).join(' > ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-sm">No specific permissions assigned</p>
                    </div>
                  )}
                </div>
                
                {/* System Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Account Created</h4>
                      <p className="text-gray-700 text-sm">
                        {formatDate(userData.createdAt)}
                        {userData.createdBy && (
                          <span className="text-gray-500 text-xs block mt-1">
                            by {userData.createdBy}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Last Updated</h4>
                      <p className="text-gray-700 text-sm">
                        {formatDate(userData.updatedAt || userData.createdAt)}
                        {userData.updatedBy && (
                          <span className="text-gray-500 text-xs block mt-1">
                            by {userData.updatedBy}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Last Login</h4>
                      <p className="text-gray-700 text-sm">
                        {userData.lastLogin ? formatDate(userData.lastLogin) : 'Never logged in'}
                        {userData.lastIpAddress && (
                          <span className="text-gray-500 text-xs block mt-1">
                            from {userData.lastIpAddress}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Login Count</h4>
                      <p className="text-gray-700 text-sm">
                        {userData.loginCount || 0} time{userData.loginCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
} 
