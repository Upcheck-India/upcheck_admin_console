'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, User, ChevronDown } from 'lucide-react';

const AddMemberForm = ({ members, setMembers }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('Contributor');
  const [error, setError] = useState(null);

  const projectRoles = ['Project Manager', 'Contributor', 'Viewer'];

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        setAllUsers(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUsers();
  }, []);

  const handleAddMember = () => {
    if (!selectedUser) {
      alert('Please select a user.');
      return;
    }
    if (members.some(member => member.user === selectedUser)) {
      alert('This user has already been added.');
      return;
    }

    const userObject = allUsers.find(u => u.username === selectedUser);
    if (userObject) {
        setMembers([...members, { user: userObject.username, email: userObject.email, role: selectedRole }]);
        setSelectedUser('');
    }
  };

  const handleRemoveMember = (userToRemove) => {
    setMembers(members.filter(member => member.user !== userToRemove));
  };

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
        <h3 className="font-medium text-gray-800">Add Project Members</h3>
        {error && <p className="text-red-500 text-sm">Error fetching users: {error}</p>}
        <div className="flex items-center gap-2">
            <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="" disabled>Select a user</option>
                {allUsers.map(user => (
                    <option key={user._id} value={user.username}>{user.username} ({user.email})</option>
                ))}
            </select>
            <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
                {projectRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                ))}
            </select>
            <button
                type="button"
                onClick={handleAddMember}
                className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200"
            >
                <Plus className="h-5 w-5" />
            </button>
        </div>

        <div className="space-y-2">
            {members.map(member => (
                <div key={member.user} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div>
                        <p className="font-semibold text-gray-800">{member.user}</p>
                        <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveMember(member.user)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
};

export default AddMemberForm;
