import React, { useState } from 'react';
import {
  CheckCircle, XCircle, Mail, Building2, Calendar, Shield, Trash2,
  AlertTriangle, Plus, Edit2, Clock, User, X, ChevronDown, ChevronUp
} from 'lucide-react';

const EXTERNAL_ROLES = ['Investor', 'Advisor', 'Legal', 'Auditor', 'Visitor', 'external_viewer'];

const ROLE_COLORS = {
  Investor: 'bg-emerald-100 text-emerald-800',
  Advisor: 'bg-blue-100 text-blue-800',
  Legal: 'bg-purple-100 text-purple-800',
  Auditor: 'bg-amber-100 text-amber-800',
  Visitor: 'bg-gray-100 text-gray-800',
  external_viewer: 'bg-slate-100 text-slate-700',
};

export default function ExternalUsersTab({ users, onApprove, onReject, onDelete, onUpdate, onAdd, currentUser, loading }) {
  const [processingId, setProcessingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteOptions, setDeleteOptions] = useState({ deleteFromClerk: true });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [expandedRows, setExpandedRows] = useState([]);
  const [addFormData, setAddFormData] = useState({
    email: '',
    name: '',
    mobileNumber: '',
    company: '',
    designation: '',
    role: 'Visitor',
    department: 'None',
    reason: '',
    expiresAt: '',
    sendInviteEmail: true,
  });

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

  const handleDeleteClick = (userId) => {
    setDeleteConfirmId(userId);
  };

  const handleDeleteConfirm = async (userId, clerkId) => {
    setProcessingId(userId);
    await onDelete(userId, clerkId, deleteOptions.deleteFromClerk);
    setProcessingId(null);
    setDeleteConfirmId(null);
    setDeleteOptions({ deleteFromClerk: true });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
    setDeleteOptions({ deleteFromClerk: true });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!addFormData.email || !addFormData.name) return;

    setProcessingId('add');
    try {
      await onAdd(addFormData);
      setShowAddModal(false);
      setAddFormData({
        email: '',
        name: '',
        mobileNumber: '',
        company: '',
        designation: '',
        role: 'Visitor',
        department: 'None',
        reason: '',
        expiresAt: '',
        sendInviteEmail: true,
      });
    } catch (err) {
      console.error('Error adding user:', err);
    }
    setProcessingId(null);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!showEditModal) return;

    setProcessingId(showEditModal._id);
    try {
      await onUpdate(showEditModal._id, {
        role: showEditModal.role,
        expiresAt: showEditModal.expiresAt,
        reason: showEditModal.reason,
        department: showEditModal.department,
      });
      setShowEditModal(null);
    } catch (err) {
      console.error('Error updating user:', err);
    }
    setProcessingId(null);
  };

  const toggleRowExpand = (userId) => {
    setExpandedRows(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      expired: 'bg-gray-100 text-gray-600 border-gray-200',
    };

    const labels = {
      pending_approval: 'Pending',
      active: 'Active',
      rejected: 'Rejected',
      expired: 'Expired',
    };

    const icons = {
      pending_approval: Clock,
      active: CheckCircle,
      rejected: XCircle,
      expired: Clock,
    };

    const Icon = icons[status] || Clock;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        <Icon className="h-3.5 w-3.5" />
        {labels[status] || status}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const colorClass = ROLE_COLORS[role] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {role}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add User Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add External User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No external users</h3>
            <p className="mt-1 text-sm text-gray-500">Add external users for data room access.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <React.Fragment key={user._id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {user.email}
                            </div>
                            {user.designation && (
                              <div className="text-xs text-gray-400">{user.designation}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                        {user.department && user.department !== 'None' && (
                          <span className="ml-2 text-xs text-gray-500">{user.department}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          {user.company ? (
                            <>
                              <Building2 className="h-4 w-4 mr-1 text-gray-400" />
                              {user.company}
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            {user.addedBy || (user.invitedBy || 'Self-registered')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(user.addedAt || user.createdAt)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.expiresAt ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-amber-700">
                              <Clock className="h-3.5 w-3.5" />
                              Until {formatDate(user.expiresAt)}
                            </div>
                            <div className="text-xs text-gray-500">Temporary</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Permanent</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {user.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApprove(user._id)}
                                disabled={processingId === user._id}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50"
                              >
                                <CheckCircle className="h-4 w-4" /> Approve
                              </button>
                              <button
                                onClick={() => handleReject(user._id)}
                                disabled={processingId === user._id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4" /> Reject
                              </button>
                            </>
                          )}
                          {user.status === 'active' && (
                            <button
                              onClick={() => setShowEditModal(user)}
                              disabled={processingId === user._id}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
                              title="Edit user"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(user._id)}
                            disabled={processingId === user._id}
                            className="text-gray-500 hover:text-red-600 disabled:opacity-50 flex items-center px-2 py-1 rounded hover:bg-gray-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleRowExpand(user._id)}
                            className="text-gray-400 hover:text-gray-600 px-1"
                          >
                            {expandedRows.includes(user._id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded details row */}
                    {expandedRows.includes(user._id) && (
                      <tr className="bg-gray-50">
                        <td colSpan="7" className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {user.mobileNumber && (
                              <div>
                                <span className="text-gray-500 font-medium">Mobile:</span>
                                <p className="text-gray-900">{user.mobileNumber}</p>
                              </div>
                            )}
                            {user.reason && (
                              <div className="col-span-2">
                                <span className="text-gray-500 font-medium">Reason:</span>
                                <p className="text-gray-900">{user.reason}</p>
                              </div>
                            )}
                            {user.address && (
                              <div className="col-span-2">
                                <span className="text-gray-500 font-medium">Address:</span>
                                <p className="text-gray-900">{user.address}</p>
                              </div>
                            )}
                            {user.emailVerified && (
                              <div>
                                <span className="text-gray-500 font-medium">Email:</span>
                                <p className="text-green-700 flex items-center gap-1">
                                  <CheckCircle className="h-3.5 w-3.5" /> Verified
                                </p>
                              </div>
                            )}
                            {user.lastLoginAt && (
                              <div>
                                <span className="text-gray-500 font-medium">Last Login:</span>
                                <p className="text-gray-900">{formatDate(user.lastLoginAt)}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add External User</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Create a new external user with data room access.</p>
            </div>

            <form onSubmit={handleAddUser} className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addFormData.name}
                      onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={addFormData.email}
                      onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <select
                      value={addFormData.role}
                      onChange={(e) => setAddFormData({ ...addFormData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      {EXTERNAL_ROLES.filter(r => r !== 'external_viewer').map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                    <select
                      value={addFormData.department}
                      onChange={(e) => setAddFormData({ ...addFormData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      <option value="None">None</option>
                      <option value="Development">Development</option>
                      <option value="Testing">Testing</option>
                      <option value="QA">QA</option>
                      <option value="Design">Design</option>
                      <option value="Product">Product</option>
                      <option value="Sales">Sales</option>
                      <option value="Finance">Finance</option>
                      <option value="Legal">Legal</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                    <input
                      type="text"
                      value={addFormData.company}
                      onChange={(e) => setAddFormData({ ...addFormData, company: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation</label>
                    <input
                      type="text"
                      value={addFormData.designation}
                      onChange={(e) => setAddFormData({ ...addFormData, designation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
                  <input
                    type="text"
                    value={addFormData.mobileNumber}
                    onChange={(e) => setAddFormData({ ...addFormData, mobileNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for Access</label>
                  <textarea
                    value={addFormData.reason}
                    onChange={(e) => setAddFormData({ ...addFormData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    rows={2}
                    placeholder="Why is this user being given access?"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={addFormData.expiresAt !== ''}
                      onChange={(e) => setAddFormData({ ...addFormData, expiresAt: e.target.checked ? '' : '' })}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-800">Temporary Access (auto-expire)</span>
                  </label>
                  {addFormData.expiresAt !== '' && (
                    <div>
                      <label className="block text-sm text-amber-700 mb-1.5">Expires On</label>
                      <input
                        type="datetime-local"
                        value={addFormData.expiresAt}
                        onChange={(e) => setAddFormData({ ...addFormData, expiresAt: e.target.value })}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                      />
                      <p className="text-xs text-amber-600 mt-1">
                        User will be automatically deactivated and cannot login after this date.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addFormData.sendInviteEmail}
                    onChange={(e) => setAddFormData({ ...addFormData, sendInviteEmail: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Send invite email with login credentials</span>
                </div>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={processingId === 'add' || !addFormData.email || !addFormData.name}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {processingId === 'add' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit External User</h3>
                <button onClick={() => setShowEditModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{showEditModal.name} - {showEditModal.email}</p>
            </div>

            <form onSubmit={handleEditUser} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={showEditModal.role}
                  onChange={(e) => setShowEditModal({ ...showEditModal, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {EXTERNAL_ROLES.filter(r => r !== 'external_viewer').map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <select
                  value={showEditModal.department || 'None'}
                  onChange={(e) => setShowEditModal({ ...showEditModal, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="None">None</option>
                  <option value="Development">Development</option>
                  <option value="Testing">Testing</option>
                  <option value="QA">QA</option>
                  <option value="Design">Design</option>
                  <option value="Product">Product</option>
                  <option value="Sales">Sales</option>
                  <option value="Finance">Finance</option>
                  <option value="Legal">Legal</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Access Expiry</label>
                <input
                  type="datetime-local"
                  value={showEditModal.expiresAt ? new Date(showEditModal.expiresAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setShowEditModal({ ...showEditModal, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for permanent access.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
                <textarea
                  value={showEditModal.reason || ''}
                  onChange={(e) => setShowEditModal({ ...showEditModal, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === showEditModal._id}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {processingId === showEditModal._id && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 bg-red-100 rounded-full p-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">Delete External User</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete this external user? This action cannot be undone.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteFromClerk}
                    onChange={(e) => setDeleteOptions({ deleteFromClerk: e.target.checked })}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm text-amber-800">
                    Also delete from Clerk (removes login ability)
                  </span>
                </label>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={processingId === deleteConfirmId}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const user = users.find(u => u._id === deleteConfirmId);
                  handleDeleteConfirm(deleteConfirmId, user?.clerkId);
                }}
                disabled={processingId === deleteConfirmId}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {processingId === deleteConfirmId && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}