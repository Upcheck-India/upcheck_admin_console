'use client';

import { useState, useEffect } from 'react';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Users, Mail, UserPlus, Shield } from 'lucide-react';

export default function UsersPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [externalUsers, setExternalUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('groups');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', members: [] });
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'viewer' });

  useEffect(() => {
    fetchGroups();
    fetchExternalUsers();
  }, []);

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

  async function fetchExternalUsers() {
    try {
      const response = await fetch('/api/dataroom/external-users');
      if (response.ok) {
        const data = await response.json();
        setExternalUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch external users:', error);
    }
  }

  async function handleCreateGroup() {
    try {
      const response = await fetch('/api/dataroom/user-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm),
      });

      if (response.ok) {
        setShowGroupModal(false);
        setGroupForm({ name: '', description: '', members: [] });
        fetchGroups();
      }
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  }

  async function handleInviteUser() {
    try {
      const response = await fetch('/api/dataroom/external-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        setShowInviteModal(false);
        setInviteForm({ email: '', name: '', role: 'viewer' });
        fetchExternalUsers();
      }
    } catch (error) {
      console.error('Failed to invite user:', error);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dataroom')} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">User Management</h1>
                <p className="text-sm text-slate-500">Manage groups and external users</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setShowGroupModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>New Group</span>
              </button>
              <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2">
                <UserPlus className="w-4 h-4" />
                <span>Invite User</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'groups' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            User Groups ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'external' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            External Users ({externalUsers.length})
          </button>
        </div>

        {/* User Groups */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No groups yet</h3>
                <p className="text-slate-500">Create groups to organize users</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group._id} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{group.name}</h3>
                      <p className="text-xs text-slate-500">{group.members?.length || 0} members</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{group.description || 'No description'}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* External Users */}
        {activeTab === 'external' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {externalUsers.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No external users</h3>
                <p className="text-slate-500">Invite external users to collaborate</p>
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">User</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Role</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Invited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {externalUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-50">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.status === 'active' ? 'bg-green-100 text-green-700' :
                          user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create User Group</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Group Name"
                value={groupForm.name}
                onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <textarea
                placeholder="Description"
                value={groupForm.description}
                onChange={(e) => setGroupForm({...groupForm, description: e.target.value})}
                rows="3"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
              <button onClick={handleCreateGroup} disabled={!groupForm.name.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Invite External User</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
              <button onClick={handleInviteUser} disabled={!inviteForm.email.trim() || !inviteForm.name.trim()} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Send Invite</button>
            </div>
          </div>
        </div>
      )}
      </div>
      <nav className="fixed top-0 left-0 w-64 bg-white h-screen p-6 shadow-md">
        <ul>
          <li className="mb-4">
            <a href="#" className="text-lg font-bold text-slate-900">Dashboard</a>
          </li>
          <li className="mb-4">
            <a href="#" className="text-lg font-bold text-slate-900">Settings</a>
          </li>
          <li className="mb-4">
            <a href="#" className="text-lg font-bold text-slate-900">Help</a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
