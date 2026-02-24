'use client';

import { useState, useEffect } from 'react';
import { Users, Shield, Clock, Mail, Building, MapPin, Search, Filter, X } from 'lucide-react';

export default function RoomUsersList({ roomId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (roomId) {
      fetchRoomUsers();
    }
  }, [roomId]);

  async function fetchRoomUsers() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch room users:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    admin: users.filter(u => u.permissions?.includes('admin')).length,
    write: users.filter(u => u.permissions?.includes('write') && !u.permissions?.includes('admin')).length,
    read: users.filter(u => u.permissions?.includes('read') && !u.permissions?.includes('write')).length,
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-slate-600 mt-4">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">Total Users</p>
              <p className="text-3xl font-bold">{users.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">Admins</p>
              <p className="text-3xl font-bold">{roleStats.admin}</p>
            </div>
            <Shield className="w-12 h-12 text-purple-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">Writers</p>
              <p className="text-3xl font-bold">{roleStats.write}</p>
            </div>
            <Users className="w-12 h-12 text-green-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">Readers</p>
              <p className="text-3xl font-bold">{roleStats.read}</p>
            </div>
            <Users className="w-12 h-12 text-orange-200 opacity-80" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 border rounded-lg flex items-center space-x-2 ${
            showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-700'
          }`}
        >
          <Filter className="w-5 h-5" />
          <span>Filters</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Filter by Role</h3>
            <button onClick={() => setShowFilters(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'admin', 'write', 'read'].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  roleFilter === role
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {role === 'all' ? 'All Users' : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Users Found</h3>
          <p className="text-slate-500">
            {searchTerm ? 'Try adjusting your search or filters' : 'No users have access to this room'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Permissions</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Last Active</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.userId} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {user.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.userName}</p>
                          <div className="flex items-center space-x-1 text-sm text-slate-500">
                            <Mail className="w-3 h-3" />
                            <span>{user.userEmail}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                          user.isExternal
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.isExternal ? 'External' : 'Internal'}
                        </span>
                        {user.orgRole && (
                          <div className="flex items-center space-x-1 text-xs text-slate-600">
                            <Building className="w-3 h-3" />
                            <span>{user.orgRole}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.permissions?.map((perm) => (
                          <span
                            key={perm}
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              perm === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : perm === 'write'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1 text-sm text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>
                          {user.lastActivity
                            ? new Date(user.lastActivity).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {user.location ? (
                        <div className="flex items-center space-x-1 text-sm text-slate-600">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {user.location.city}, {user.location.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Unknown</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
