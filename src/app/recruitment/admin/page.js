'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserPlus, Copy, X, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import LoadingState from '../components/LoadingState';

export default function ApplicantsManagement() {
  const [applicants, setApplicants] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [initRolesComplete, setInitRolesComplete] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [initRolesLoading, setInitRolesLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [showTrashed, setShowTrashed] = useState(false);
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, hasPermission, user: currentUser } = useAuth(true, 'recruitment.manage');

  useEffect(() => {
    if (isAuthenticated) {
      setupRecruitment();
      fetchData(); // Fetch roles and applicants when component loads
    }
  }, [isAuthenticated]);

  // Setup functions for recruitment system
  const setupRecruitment = async () => {
    if (setupComplete || setupLoading) return;
    
    try {
      setSetupLoading(true);
      const response = await fetch('/api/recruitment/setup', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to setup recruitment system');
      }

      const data = await response.json();
      console.log('Setup complete:', data.message);
      setSetupComplete(true);
      setError('');
    } catch (error) {
      console.error('Setup error:', error);
      setError('Failed to initialize recruitment system permissions');
    } finally {
      setSetupLoading(false);
    }
  };

  const initializeRoles = async () => {
    if (initRolesComplete || initRolesLoading) return;
    
    try {
      setInitRolesLoading(true);
      const response = await fetch('/api/recruitment/setup/init-roles', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to initialize recruitment roles');
      }

      const data = await response.json();
      console.log('Roles initialized:', data.message);
      setInitRolesComplete(true);
      setError('');
      // Refresh roles data after initialization
      fetchData();
    } catch (error) {
      console.error('Role initialization error:', error);
      setError('Failed to initialize recruitment roles');
    } finally {
      setInitRolesLoading(false);
    }
  };

  const fetchData = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      const [rolesRes, applicantsRes] = await Promise.all([
        fetch('/api/recruitment/roles'),
        fetch(`/api/recruitment/applicants?includeDeleted=${showTrashed}`)
      ]);

      if (!rolesRes.ok || !applicantsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [rolesData, applicantsData] = await Promise.all([
        rolesRes.json(),
        applicantsRes.json()
      ]);

      setRoles(rolesData);
      setApplicants(applicantsData);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/recruitment/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      const newApplicant = await res.json();
      setApplicants([newApplicant, ...applicants]);
      setIsModalOpen(false);
      setFormData({ name: '', email: '', role: '' });
      
      // Refresh data after adding a new applicant
      fetchData();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleAction = async (applicantId, action) => {
    if (!confirm(`Are you sure you want to ${action} this applicant?`)) return;

    try {
      const res = await fetch('/api/recruitment/applicants/patch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantId, action })
      });

      if (!res.ok) throw new Error(`Failed to ${action} applicant`);
      
      // Refresh the applicants list
      await fetchData();
    } catch (error) {
      setError(error.message);
    }
  };

  const copyToClipboard = async (text, applicantId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(applicantId);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (error) {
      setError('Failed to copy to clipboard');
    }
  };

  if (authLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated || !hasPermission) {
    return <div>Unauthorized access</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Setup Section - Only visible for Console admin */}
        {currentUser?.role === 'Console admin' && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">System Setup</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">1. Initialize Permissions</h3>
                <button
                  onClick={setupRecruitment}
                  disabled={setupLoading || setupComplete}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    setupComplete 
                      ? 'bg-green-100 text-green-800 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {setupLoading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Setting up...</span>
                    </>
                  ) : setupComplete ? (
                    <span>✓ Permissions Initialized</span>
                  ) : (
                    <span>Initialize Permissions</span>
                  )}
                </button>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">2. Initialize Test Roles</h3>
                <button
                  onClick={initializeRoles}
                  disabled={initRolesLoading || initRolesComplete}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    initRolesComplete
                      ? 'bg-green-100 text-green-800 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {initRolesLoading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Initializing roles...</span>
                    </>
                  ) : initRolesComplete ? (
                    <span>✓ Roles Initialized</span>
                  ) : (
                    <span>Initialize Test Roles</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Manage Applicants
            </h1>
            <button
              onClick={() => {
                setShowTrashed(!showTrashed);
                fetchData();
              }}
              className={`px-3 py-1 rounded-md text-sm ${
                showTrashed
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {showTrashed ? 'Hide Trashed' : 'Show Trashed'}
            </button>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/recruitment/roles')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Manage Roles
            </button>
            <button
              onClick={() => {
                fetchData(); // Refresh roles data before opening modal
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Add Applicant
            </button>
          </div>
        </div>

        <ErrorMessage message={error} onClose={() => setError('')} />

        <div className="bg-white shadow rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credentials</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {applicants
                  .filter(a => showTrashed ? a.deleted : !a.deleted)
                  .map((applicant) => (
                  <tr key={applicant.applicantId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{applicant.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{applicant.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {roles.find(r => r.id === applicant.role)?.name || applicant.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">ID:</span>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {applicant.applicantId}
                          </code>
                          <button
                            onClick={() => copyToClipboard(applicant.applicantId, `id-${applicant.applicantId}`)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy ID"
                          >
                            {copySuccess === `id-${applicant.applicantId}` ? (
                              <span className="text-green-500 text-xs">Copied!</span>
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {applicant.password && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">Pass:</span>
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              {applicant.password}
                            </code>
                            <button
                              onClick={() => copyToClipboard(applicant.password, `pass-${applicant.applicantId}`)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Copy Password"
                            >
                              {copySuccess === `pass-${applicant.applicantId}` ? (
                                <span className="text-green-500 text-xs">Copied!</span>
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        applicant.deleted
                          ? 'bg-red-100 text-red-800'
                          : applicant.status === 'revoked'
                          ? 'bg-yellow-100 text-yellow-800'
                          : applicant.hasAttempted
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {applicant.deleted 
                          ? 'Trashed'
                          : applicant.status === 'revoked'
                          ? 'Revoked'
                          : applicant.hasAttempted 
                          ? 'Completed' 
                          : 'Pending'
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        {applicant.deleted ? (
                          <>
                            <button
                              onClick={() => handleAction(applicant.applicantId, 'restore')}
                              className="text-green-600 hover:text-green-900"
                              title="Restore"
                            >
                              <RefreshCw className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleAction(applicant.applicantId, 'delete')}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Permanently"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {!applicant.hasAttempted && (
                              <button
                                onClick={() => handleAction(applicant.applicantId, 'trash')}
                                className="text-red-600 hover:text-red-900"
                                title="Move to Trash"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            )}
                            {applicant.hasAttempted && !applicant.deleted && (
                              <button
                                onClick={() => handleAction(applicant.applicantId, 'revoke')}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Revoke Access"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Applicant
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create credentials for a new applicant
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a role...</option>
                      {roles.filter(role => role.isActive).map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 sm:mt-6">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create Applicant
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}