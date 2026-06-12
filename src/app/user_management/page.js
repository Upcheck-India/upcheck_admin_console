'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Trash2, Edit2, Plus, X, Search, User,
  AlertCircle, Building2, Filter, Mail, MessageCircle,
  CodeXml, FileText, Settings as SettingsIcon, CheckCircle, ChevronDown
} from 'lucide-react';
import DocumentationSettingsModal from './components/DocumentationSettingsModal';
import ExternalUsersTab from './components/ExternalUsersTab';
import TeamsTab from './components/TeamsTab';
import HRNav from './_components/HRNav';

// Add this function outside of the component
const preventFocusLoss = (e) => e.target.select();

const UserManagement = () => {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    role: ''
  });
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: '',
    department: 'Unassigned',
    perms: [],
    // HR fields
    firstName: '',
    lastName: '',
    jobTitle: '',
    employmentType: 'full_time',
    employmentStatus: 'active',
    managerId: '',
    startDate: '',
    phone: '',
    location: ''
  });

  // Employment types and statuses
  const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern'];
  const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'];

  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState({ valid: true, errors: [] });
  const [formErrors, setFormErrors] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const [sortConfig, setSortConfig] = useState({ field: 'role', order: 'asc' });
  const [filterConfig, setFilterConfig] = useState({
    role: 'all',
    department: 'all'
  });

  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Handle click outside for settings dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !event.target.closest('.settings-dropdown-button')) {
        setSettingsDropdownOpen(false);
      }
    };

    if (settingsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsDropdownOpen]);
  const [showDocSettings, setShowDocSettings] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);

  // External users state
  const [activeTab, setActiveTab] = useState('internal'); // 'internal' or 'external'
  const [externalUsers, setExternalUsers] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingExternal, setLoadingExternal] = useState(false);

  const ROLES_HIERARCHY = {
    'Console admin': ['Admin', 'Member', 'Intern'],
    'Admin': ['Member', 'Intern'],
    'Member': [],
    'Intern': []
  };

  const ROLE_COLORS = {
    'Console admin': 'bg-purple-100 text-purple-800',
    'Admin': 'bg-blue-100 text-blue-800',
    'Member': 'bg-green-100 text-green-800',
    'Intern': 'bg-orange-100 text-orange-800'
  };

  const DEPARTMENTS = [
    'Development',
    'Testing',
    'QA',
    'Design',
    'Product',
    'Sales',
    'Content',
    'Marketing',
    'Operations',
    'HR',
    'Finance',
    'Unassigned'
  ];

  const getAvailableRoles = () => {
    return ROLES_HIERARCHY[currentUser?.role] || [];
  };

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const checkAuthAndFetchUsers = async () => {
    try {
      console.log('Checking auth...');
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Session check failed');
      }

      const data = await response.json();
      console.log('Auth response:', data);

      if (!data.user || !data.user.role) {
        router.push('/login');
        return;
      }

      setCurrentUser(data.user);
      if (data.user.role !== 'Intern') {
        fetchUsers(data.user.role);
        // Fetch external users for admins
        if (data.user.role === 'Admin' || data.user.role === 'Console admin') {
          fetchExternalUsers();
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/login');
    }
  };

  const fetchExternalUsers = async () => {
    try {
      setLoadingExternal(true);
      const response = await fetch('/api/user-management/external-users', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch external users');
      }

      const data = await response.json();
      setExternalUsers(data.users || []);
      
      // Count pending users
      const pending = data.users.filter(u => u.status === 'pending_approval').length;
      setPendingCount(pending);
    } catch (err) {
      console.error('Failed to fetch external users:', err);
    } finally {
      setLoadingExternal(false);
    }
  };

  const fetchUsers = async (userRole) => {
    try {
      setLoading(true);
      console.log('Fetching users with role:', userRole);

      const response = await fetch('/api/users', {
        headers: {
          'x-user-role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch users:', error);
        throw new Error(error.error || 'Failed to fetch users');
      }

      const data = await response.json();
      // API returns { users: [...], pagination: {...} }
      const usersArray = data.users || [];
      console.log('Users fetched:', usersArray.length);
      console.log('User roles:', usersArray.map(user => user.role));
      setUsers(usersArray);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e, submittedData) => {
    e.preventDefault();

    const errors = {};
    if (!submittedData.username) errors.username = 'Username is required';
    if (modalMode === 'add' && !submittedData.password) errors.password = 'Password is required';
    if (!submittedData.role) errors.role = 'Role is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const url = modalMode === 'add' ? '/api/users' : `/api/users/${selectedUser._id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const submitData = {
        ...submittedData,
        password: modalMode === 'add' ? submittedData.password : undefined
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Operation failed');
      }

      await fetchUsers(currentUser?.role);
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUser?.role
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      await fetchUsers(currentUser?.role);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveExternalUser = async (userId) => {
    try {
      const response = await fetch('/api/user-management/external-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, action: 'approve' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve user');
      }

      await fetchExternalUsers();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectExternalUser = async (userId) => {
    if (!window.confirm('Are you sure you want to reject this user registration?')) return;

    try {
      const response = await fetch('/api/user-management/external-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, action: 'reject' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject user');
      }

      await fetchExternalUsers();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteExternalUser = async (userId, clerkId, deleteFromClerk) => {
    try {
      const params = new URLSearchParams({ userId });
      if (clerkId) params.append('clerkId', clerkId);
      if (deleteFromClerk) params.append('deleteFromClerk', 'true');

      const response = await fetch(`/api/user-management/external-users?${params}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      await fetchExternalUsers();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddExternalUser = async (userData) => {
    try {
      const response = await fetch('/api/user-management/external-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...userData,
          addedBy: currentUser?.username || currentUser?.name || 'Admin'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }

      await fetchExternalUsers();
      setError(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleUpdateExternalUser = async (userId, updateData) => {
    try {
      const response = await fetch('/api/user-management/external-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, ...updateData })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      await fetchExternalUsers();
      setError(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: '',
      department: 'Unassigned',
      perms: [],
      firstName: '',
      lastName: '',
      jobTitle: '',
      employmentType: 'full_time',
      employmentStatus: 'active',
      managerId: '',
      startDate: '',
      phone: '',
      location: ''
    });
    setFormErrors({});
    setSelectedUser(null);
    setPasswordValidation({ valid: true, errors: [] });
  };

  const canModifyUser = (userRole) => {
    if (currentUser?.role === 'Console admin') return true;
    if (currentUser?.role === 'Admin') {
      return ['Member', 'Intern'].includes(userRole);
    }
    return false;
  };

  const sortUsers = (users) => {
    const roleOrder = ['Console admin', 'Admin', 'Member', 'Intern'];

    return [...users].sort((a, b) => {
      switch (sortConfig.field) {
        case 'role':
          return sortConfig.order === 'asc'
            ? roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
            : roleOrder.indexOf(b.role) - roleOrder.indexOf(a.role);
        case 'name':
          return sortConfig.order === 'asc'
            ? a.username.localeCompare(b.username)
            : b.username.localeCompare(a.username);
        case 'lastLogin':
          return sortConfig.order === 'asc'
            ? new Date(a.lastLogin) - new Date(b.lastLogin)
            : new Date(b.lastLogin) - new Date(a.lastLogin);
        default:
          return 0;
      }
    });
  };

  const filterUsers = (users) => {
    return users.filter(user => {
      const matchesSearch = user.username.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.email?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesRole = filterConfig.role === 'all' || user.role === filterConfig.role;
      const matchesDepartment = filterConfig.department === 'all' ||
        user.department === filterConfig.department;
      return matchesSearch && matchesRole && matchesDepartment;
    });
  };

  const paginateUsers = (users) => {
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    return users.slice(indexOfFirstUser, indexOfLastUser);
  };

  const SortControls = () => (
    <div className="flex items-center gap-4 mb-4">
      <span className="text-sm font-medium text-gray-600">Sort by:</span>
      <select
        value={`${sortConfig.field}-${sortConfig.order}`}
        onChange={(e) => {
          const [field, order] = e.target.value.split('-');
          setSortConfig({ field, order });
        }}
        className="px-3 py-1 border rounded-md text-sm"
      >
        <option value="role-asc">Role (Hierarchy)</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="lastLogin-desc">Last Active (Recent)</option>
        <option value="lastLogin-asc">Last Active (Oldest)</option>
      </select>
    </div>
  );

  const FilterControls = () => (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <select
        value={filterConfig.role}
        onChange={(e) => setFilterConfig(prev => ({ ...prev, role: e.target.value }))}
        className="px-3 py-1 border rounded-md text-sm"
      >
        <option value="all">All Roles</option>
        {['Console admin', 'Admin', 'Member', 'Intern'].map(role => (
          <option key={role} value={role}>{role}</option>
        ))}
      </select>

      <select
        value={filterConfig.department}
        onChange={(e) => setFilterConfig(prev => ({ ...prev, department: e.target.value }))}
        className="px-3 py-1 border rounded-md text-sm"
      >
        <option value="all">All Departments</option>
        {DEPARTMENTS.map(dept => (
          <option key={dept} value={dept}>{dept}</option>
        ))}
      </select>
    </div>
  );

  const PaginationControls = ({ totalUsers }) => {
    const pageCount = Math.ceil(totalUsers / usersPerPage);

    return (
      <div className="mt-4 flex justify-center space-x-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-3 py-1">
          Page {currentPage} of {pageCount}
        </span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))}
          disabled={currentPage === pageCount}
          className="px-3 py-1 rounded border disabled:opacity-50"
        >
          Next
        </button>
      </div>
    );
  };

  const UserTableRow = ({ user }) => {
    // Employment status colors
    const statusColors = {
      'active': 'bg-green-100 text-green-800',
      'on_leave': 'bg-yellow-100 text-yellow-800',
      'suspended': 'bg-red-100 text-red-800',
      'terminated': 'bg-gray-100 text-gray-600'
    };

    return (
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                <button
                  onClick={() => router.push(`/user_management/${user._id}`)}
                  className="hover:underline focus:outline-none"
                >
                  {user.firstName || user.lastName
                    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                    : user.username}
                </button>
              </div>
              <div className="text-sm text-gray-500">{user.email}</div>
              {user.jobTitle && (
                <div className="text-xs text-gray-400">{user.jobTitle}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[user.role]}`}>
            {user.role}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            {user.department || 'Unassigned'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[user.employmentStatus] || statusColors['active']}`}>
            {(user.employmentStatus || 'active').charAt(0).toUpperCase() + (user.employmentStatus || 'active').slice(1).replace('_', ' ')}
          </span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-wrap gap-1">
            {user.perms?.map(perm => (
              <span key={perm} className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {perm}
              </span>
            ))}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex justify-end items-center space-x-2">
            <button
              onClick={() => router.push(`/messages/${user._id}`)}
              className="text-gray-600 hover:text-gray-900"
              title="Send Message"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => router.push(`/email/${user._id}`)}
              className="text-gray-600 hover:text-gray-900"
              title="Send Email"
            >
              <Mail className="h-5 w-5" />
            </button>
            {canModifyUser(user.role) && (
              <>
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setModalMode('edit');
                    setFormData({
                      username: user.username,
                      email: user.email || '',
                      role: user.role,
                      department: user.department || 'Unassigned',
                      perms: user.perms || [],
                      firstName: user.firstName || '',
                      lastName: user.lastName || '',
                      jobTitle: user.jobTitle || '',
                      employmentType: user.employmentType || 'full_time',
                      employmentStatus: user.employmentStatus || 'active',
                      managerId: user.managerId?.toString() || '',
                      startDate: user.startDate ? new Date(user.startDate).toISOString().split('T')[0] : '',
                      phone: user.phone || '',
                      location: user.location || ''
                    });
                    setIsModalOpen(true);
                  }}
                  className="text-blue-600 hover:text-blue-900"
                  title="Edit User"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(user._id)}
                  className="text-red-600 hover:text-red-900"
                  title="Delete User"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const UserFormModal = () => {
    const [localFormData, setLocalFormData] = useState(formData);
    const [localPasswordValidation, setLocalPasswordValidation] = useState({ valid: true, errors: [] });
    const [showAdvancedFields, setShowAdvancedFields] = useState(false);

    // Password validation function
    const validatePassword = (password) => {
      const errors = [];
      if (!password || password.length < 8) {
        errors.push('At least 8 characters');
      }
      if (password && !/[A-Z]/.test(password)) {
        errors.push('At least one uppercase letter');
      }
      if (password && !/[a-z]/.test(password)) {
        errors.push('At least one lowercase letter');
      }
      if (password && !/[0-9]/.test(password)) {
        errors.push('At least one number');
      }
      return { valid: errors.length === 0, errors };
    };

    const handlePasswordChange = (password) => {
      setLocalFormData(prev => ({ ...prev, password }));
      if (modalMode === 'add' || password) {
        setLocalPasswordValidation(validatePassword(password));
      }
    };

    const handleFormSubmit = (e) => {
      e.preventDefault();

      // Validate password for new users
      if (modalMode === 'add' && localFormData.password) {
        const validation = validatePassword(localFormData.password);
        if (!validation.valid) {
          setPasswordValidation(validation);
          return;
        }
      }

      handleSubmit(e, localFormData);
    };

    // Get managers list (users with Admin or Console admin role)
    const managerOptions = users.filter(u =>
      (u.role === 'Admin' || u.role === 'Console admin') &&
      u._id !== selectedUser?._id
    );

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === 'add' ? 'Add New User' : 'Edit User'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="user-form" onSubmit={handleFormSubmit} className="space-y-4">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Basic Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={localFormData.firstName}
                      onChange={(e) => setLocalFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={localFormData.lastName}
                      onChange={(e) => setLocalFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={localFormData.username}
                    onChange={(e) => setLocalFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={localFormData.email}
                    onChange={(e) => setLocalFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {modalMode === 'add' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      value={localFormData.password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        !localPasswordValidation.valid ? 'border-red-300' : 'border-gray-300'
                      }`}
                      required
                    />
                    {/* Password requirements */}
                    <div className="mt-2 space-y-1">
                      {localFormData.password && localPasswordValidation.errors.length > 0 && (
                        <div className="text-xs text-red-600">
                          <p className="font-medium">Password requirements:</p>
                          {localPasswordValidation.errors.map((err, idx) => (
                            <p key={idx}>• {err}</p>
                          ))}
                        </div>
                      )}
                      {!localFormData.password && (
                        <div className="text-xs text-gray-500">
                          <p>Password must have: 8+ characters, uppercase, lowercase, and number</p>
                        </div>
                      )}
                      {localFormData.password && localPasswordValidation.valid && (
                        <div className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Password meets all requirements
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Role & Department Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Role & Department</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                    <select
                      value={localFormData.role}
                      onChange={(e) => {
                        const selectedRole = e.target.value;
                        const defaultPerms = {
                          'Admin': ['users.manage', 'content.manage'],
                          'Member': [],
                          'Intern': []
                        }[selectedRole] || [];

                        setLocalFormData({
                          ...localFormData,
                          role: selectedRole,
                          perms: defaultPerms,
                          // Set employment type based on role
                          employmentType: selectedRole === 'Intern' ? 'intern' : 'full_time'
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Role</option>
                      {getAvailableRoles().map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={localFormData.department}
                      onChange={(e) => setLocalFormData({ ...localFormData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* HR Information Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFields ? 'rotate-180' : ''}`} />
                  HR Information (Optional)
                </button>

                {showAdvancedFields && (
                  <div className="space-y-4 animate-[slideIn_200ms_ease-out]">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                        <input
                          type="text"
                          value={localFormData.jobTitle}
                          onChange={(e) => setLocalFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g. Software Engineer"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                        <select
                          value={localFormData.managerId}
                          onChange={(e) => setLocalFormData(prev => ({ ...prev, managerId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">No manager assigned</option>
                          {managerOptions.map(user => (
                            <option key={user._id} value={user._id}>{user.username} ({user.role})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                        <select
                          value={localFormData.employmentType}
                          onChange={(e) => setLocalFormData(prev => ({ ...prev, employmentType: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {EMPLOYMENT_TYPES.map(type => (
                            <option key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
                        <select
                          value={localFormData.employmentStatus}
                          onChange={(e) => setLocalFormData(prev => ({ ...prev, employmentStatus: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {EMPLOYMENT_STATUSES.map(status => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={localFormData.startDate}
                          onChange={(e) => setLocalFormData(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={localFormData.phone}
                          onChange={(e) => setLocalFormData(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Phone number"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input
                        type="text"
                        value={localFormData.location}
                        onChange={(e) => setLocalFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g. Chennai, India"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Permissions Section (Console admin only) */}
              {currentUser?.role === 'Console admin' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Permissions</h3>
                  <div className="space-y-2">
                    {['users.manage', 'content.manage', 'department.manage', 'department.assign'].map(perm => (
                      <label key={perm} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={localFormData.perms.includes(perm)}
                          onChange={(e) => {
                            const updatedPerms = e.target.checked
                              ? [...localFormData.perms, perm]
                              : localFormData.perms.filter(p => p !== perm);
                            setLocalFormData({ ...localFormData, perms: updatedPerms });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(formErrors).length > 0 && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md">
                  {Object.values(formErrors).map((error, index) => (
                    <p key={index} className="text-sm">{error}</p>
                  ))}
                </div>
              )}
            </form>
          </div>

          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 mt-auto">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="user-form"
              disabled={modalMode === 'add' && !localPasswordValidation.valid}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modalMode === 'add' ? 'Create User' : 'Update User'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DocumentationSettingsModalComponent = () => {
    return (
      <DocumentationSettingsModal
        isOpen={showDocSettings}
        onClose={() => {
          setShowDocSettings(false);
          setSettingsDropdownOpen(false);
        }}
      />
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-blue-400 h-12 w-12"></div>
          <div className="space-y-4">
            <div className="h-4 bg-blue-400 rounded w-24"></div>
            <div className="h-4 bg-blue-400 rounded w-36"></div>
          </div>
        </div>
      </div>
    );
  }

  // Members and Interns can only see Teams tab, so redirect there directly
  if (currentUser.role === 'Intern' || currentUser.role === 'Member') {
    // Set active tab to teams directly
    if (activeTab !== 'teams') {
      setActiveTab('teams');
    }
  }

  if (loading && currentUser.role !== 'Intern' && currentUser.role !== 'Member') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-blue-400 h-12 w-12"></div>
          <div className="space-y-4">
            <div className="h-4 bg-blue-400 rounded w-24"></div>
            <div className="h-4 bg-blue-400 rounded w-36"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Documentation Settings Modal */}
      <DocumentationSettingsModal
        isOpen={showDocSettings}
        onClose={() => setShowDocSettings(false)}
      />

      <div className="max-w-7xl mx-auto">
        <HRNav />
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex space-x-2 border-b border-gray-200">
              {(currentUser.role === 'Admin' || currentUser.role === 'Console admin') && (
                <>
                  <button
                    onClick={() => setActiveTab('internal')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      activeTab === 'internal'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Internal Users
                  </button>
                  <button
                    onClick={() => setActiveTab('external')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'external'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    External Users
                    {pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                </>
              )}
              <button
                onClick={() => setActiveTab('teams')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'teams'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Teams
              </button>
            </div>
          </div>

          {/* Show user search and Add User button only for Admins/Console admins */}
            {(currentUser.role === 'Admin' || currentUser.role === 'Console admin') && activeTab !== 'teams' && (
              <>
                <div className="relative flex-grow md:flex-grow-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  {ROLES_HIERARCHY[currentUser?.role]?.length > 0 && (
                    <button
                      onClick={() => {
                        setModalMode('add');
                        setIsModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add User
                    </button>
                  )}

                  {/* Settings Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                    >
                      <SettingsIcon className="h-5 w-5 mr-2" />
                      Settings
                      <svg
                        className={`ml-2 w-4 h-4 transition-transform ${settingsDropdownOpen ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {settingsDropdownOpen && (
                      <div
                        className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg z-10 border border-gray-200"
                        ref={dropdownRef}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setShowDocSettings(true);
                              setSettingsDropdownOpen(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <FileText className="h-4 w-4 mr-2 text-gray-500" />
                            Documentation Settings
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <div className="px-4 py-2 text-xs text-gray-500">
                            More settings coming soon...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-700 hover:text-red-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {activeTab === 'internal' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <SortControls />
              <FilterControls />
            </div>

            <div className="overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          User
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Role
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Department
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Last Login
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Permissions
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginateUsers(sortUsers(filterUsers(users))).map(user => (
                        <UserTableRow key={user._id} user={user} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <PaginationControls totalUsers={sortUsers(filterUsers(users)).length} />
          </div>
        ) : activeTab === 'external' ? (
          <ExternalUsersTab
            users={externalUsers}
            onApprove={handleApproveExternalUser}
            onReject={handleRejectExternalUser}
            onDelete={handleDeleteExternalUser}
            onAdd={handleAddExternalUser}
            onUpdate={handleUpdateExternalUser}
            currentUser={currentUser}
            loading={loadingExternal}
          />
        ) : (
          <TeamsTab currentUser={currentUser} onRefresh={fetchUsers} />
        )}
      </div>

      {isModalOpen && <UserFormModal />}
    </div>
  );
};

export default UserManagement;