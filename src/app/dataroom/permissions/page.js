'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SecureLoading from '../../components/SecureLoading';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function PermissionsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [accessRequests, setAccessRequests] = useState([]);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchAccessRequests();
  }, [filter]);

  async function fetchAccessRequests() {
    try {
      const url = filter === 'all' 
        ? '/api/dataroom/permissions/request' 
        : `/api/dataroom/permissions/request?status=${filter}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAccessRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch access requests:', error);
    }
  }

  async function handleApprove(requestId, approve) {
    try {
      const response = await fetch('/api/dataroom/permissions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          approve,
          permissionLevel: 'viewer'
        }),
      });

      if (response.ok) {
        fetchAccessRequests();
      }
    } catch (error) {
      console.error('Failed to process request:', error);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const filters = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/dataroom')} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Access Requests</h1>
              <p className="text-sm text-slate-500">Review and approve access requests</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex space-x-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg ${
                filter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {accessRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No access requests</h3>
            <p className="text-slate-500">All caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">User</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Resource</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Reason</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Requested</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Status</th>
                  <th className="text-right py-3 px-6 text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accessRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-slate-900">{request.requestedBy?.email || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{request.requestedBy?.name || '-'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{request.resourceType}</p>
                        <p className="text-xs text-slate-500">{request.resourceId}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-600">{request.reason || 'No reason provided'}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center text-sm text-slate-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDate(request.requestedAt)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'approved' ? 'bg-green-100 text-green-700' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {request.status === 'pending' && (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleApprove(request._id, true)}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApprove(request._id, false)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {request.status !== 'pending' && (
                        <div className="flex items-center justify-end text-xs text-slate-500">
                          {request.status === 'approved' && request.approvedBy && (
                            <span>by {request.approvedBy.email}</span>
                          )}
                          {request.status === 'rejected' && request.rejectedBy && (
                            <span>by {request.rejectedBy.email}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
