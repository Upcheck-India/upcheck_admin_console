import React, { useState } from 'react';
import { CheckCircle, XCircle, Mail, Building2, Calendar, Shield } from 'lucide-react';

export default function ExternalUsersTab({ users, onApprove, onReject, loading }) {
  const [processingId, setProcessingId] = useState(null);

  const handleApprove = async (userId) => {
    setProcessingId(userId);
    await onApprove(userId);
    setProcessingId(null);
  };

  const handleReject = async (userId) => {
    setProcessingId(userId);
    await onReject(userId);
    setProcessingId(null);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending_approval: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };

    const labels = {
      pending_approval: 'Pending Approval',
      active: 'Active',
      rejected: 'Rejected',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No external users</h3>
        <p className="mt-1 text-sm text-gray-500">No external user registrations yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Verified</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      {user.designation && <div className="text-sm text-gray-500">{user.designation}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 flex items-center">
                    <Mail className="h-4 w-4 mr-1 text-gray-400" />
                    {user.email}
                  </div>
                  {user.mobileNumber && (
                    <div className="text-sm text-gray-500">{user.mobileNumber}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 flex items-center">
                    {user.company && (
                      <>
                        <Building2 className="h-4 w-4 mr-1 text-gray-400" />
                        {user.company}
                      </>
                    )}
                    {!user.company && <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(user.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.emailVerified ? (
                    <span className="text-green-600 flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center text-sm">
                      <XCircle className="h-4 w-4 mr-1" />
                      Not verified
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.status === 'pending_approval' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApprove(user._id)}
                        disabled={processingId === user._id}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50 flex items-center"
                      >
                        <CheckCircle className="h-5 w-5 mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(user._id)}
                        disabled={processingId === user._id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 flex items-center"
                      >
                        <XCircle className="h-5 w-5 mr-1" />
                        Reject
                      </button>
                    </div>
                  )}
                  {user.status === 'active' && (
                    <span className="text-gray-500">Active</span>
                  )}
                  {user.status === 'rejected' && (
                    <span className="text-gray-500">Rejected</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show details section for users with additional info */}
      {users.some(u => u.purpose || u.invitedBy || u.address) && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Information</h4>
          <div className="space-y-2 text-sm text-gray-600">
            {users.filter(u => u.purpose || u.invitedBy).map(user => (
              <div key={user._id} className="border-l-2 border-blue-400 pl-3">
                <p className="font-medium">{user.name}</p>
                {user.purpose && <p><strong>Purpose:</strong> {user.purpose}</p>}
                {user.invitedBy && <p><strong>Invited by:</strong> {user.invitedBy}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
