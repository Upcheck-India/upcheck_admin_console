'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Users, User, Shield } from 'lucide-react';

export default function PermissionManager({ 
  resourceType, 
  resourceId, 
  roomId,
  isOpen, 
  onClose 
}) {
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    targetType: 'user',
    userId: '',
    userEmail: '',
    groupId: '',
    permissions: [],
    expiresAt: '',
  });

  const PERMISSION_OPTIONS = [
    { value: 'view', label: 'View', description: 'Can view the resource' },
    { value: 'comment', label: 'Comment', description: 'Can add comments' },
    { value: 'edit', label: 'Edit', description: 'Can modify the resource' },
    { value: 'download', label: 'Download', description: 'Can download files' },
    { value: 'print', label: 'Print', description: 'Can print documents' },
    { value: 'admin', label: 'Admin', description: 'Full control' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchPermissions();
      fetchUsers();
      fetchGroups();
    }
  }, [isOpen, resourceType, resourceId]);

  async function fetchPermissions() {
    try {
      const response = await fetch(`/api/dataroom/permissions?resourceType=${resourceType}&resourceId=${resourceId}`);
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch('/api/dataroom/org-users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }

  async function fetchGroups() {
    try {
      const response = await fetch('/api/dataroom/user-groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }

  async function handleAddPermission() {
    try {
      const payload = {
        resourceType,
        resourceId,
        roomId,
        permissions: formData.permissions,
        expiresAt: formData.expiresAt || null,
      };

      if (formData.targetType === 'user') {
        if (formData.userId) payload.userId = formData.userId;
        if (formData.userEmail) payload.userEmail = formData.userEmail;
      } else {
        payload.groupId = formData.groupId;
      }

      const response = await fetch('/api/dataroom/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddForm(false);
        setFormData({
          targetType: 'user',
          userId: '',
          userEmail: '',
          groupId: '',
          permissions: [],
          expiresAt: '',
        });
        fetchPermissions();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add permission');
      }
    } catch (error) {
      console.error('Failed to add permission:', error);
      alert('Failed to add permission');
    }
  }

  async function handleRevokePermission(permissionId) {
    if (!confirm('Are you sure you want to revoke this permission?')) return;

    try {
      const response = await fetch(`/api/dataroom/permissions?id=${permissionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPermissions();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to revoke permission');
      }
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      alert('Failed to revoke permission');
    }
  }

  function togglePermission(perm) {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manage Permissions</h2>
            <p className="text-sm text-slate-500">Control who can access this {resourceType}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading permissions...</p>
            </div>
          ) : (
            <>
              {/* Current Permissions */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Current Permissions</h3>
                {permissions.length === 0 ? (
                  <div className="bg-slate-50 rounded-lg p-8 text-center">
                    <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">No permissions set</p>
                    <p className="text-sm text-slate-500 mt-1">Add permissions to control access</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {permissions.map((perm) => (
                      <div key={perm._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {perm.userId ? <User className="w-4 h-4 text-blue-600" /> : <Users className="w-4 h-4 text-green-600" />}
                            <span className="font-medium text-slate-900">
                              {perm.userEmail || perm.groupId || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {perm.permissions.map((p) => (
                              <span key={p} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                {p}
                              </span>
                            ))}
                          </div>
                          {perm.expiresAt && (
                            <div className="flex items-center space-x-1 mt-2 text-xs text-slate-500">
                              <Calendar className="w-3 h-3" />
                              <span>Expires: {new Date(perm.expiresAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRevokePermission(perm._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Revoke"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Permission Form */}
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Permission</span>
                </button>
              ) : (
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Permission</h3>
                  
                  {/* Target Type */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Grant to</label>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setFormData({ ...formData, targetType: 'user' })}
                        className={`flex-1 px-4 py-2 rounded-lg border ${
                          formData.targetType === 'user'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        User
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, targetType: 'group' })}
                        className={`flex-1 px-4 py-2 rounded-lg border ${
                          formData.targetType === 'group'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        Group
                      </button>
                    </div>
                  </div>

                  {/* User/Group Selector */}
                  {formData.targetType === 'user' ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Select User</label>
                      <select
                        value={formData.userId}
                        onChange={(e) => {
                          const user = users.find(u => u._id === e.target.value);
                          setFormData({ ...formData, userId: e.target.value, userEmail: user?.email || '' });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option value="">Select a user...</option>
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.username} ({user.email}) - {user.role}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Select Group</label>
                      <select
                        value={formData.groupId}
                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option value="">Select a group...</option>
                        {groups.map((group) => (
                          <option key={group._id} value={group._id}>
                            {group.name} ({group.members?.length || 0} members)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Permissions */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Permissions</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PERMISSION_OPTIONS.map((opt) => (
                        <label key={opt.value} className="flex items-start space-x-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(opt.value)}
                            onChange={() => togglePermission(opt.value)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 text-sm">{opt.label}</p>
                            <p className="text-xs text-slate-500">{opt.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Expiry Date */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPermission}
                      disabled={!formData.permissions.length || (formData.targetType === 'user' ? !formData.userId : !formData.groupId)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Permission
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
