'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Mail, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

const ManageMembersForm = ({ initialMembers, onMembersChange, superManager, project }) => {
  const [members, setMembers] = useState(initialMembers || []);
  const [notifyNewMembers, setNotifyNewMembers] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('Contributor');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState({});

  const projectRoles = ['Project Manager', 'Contributor', 'Viewer'];

  // Debug logging to help identify the issue
  console.log('superManager prop:', superManager);
  console.log('members:', members);

  // Memoize available users to prevent unnecessary re-renders
  const availableUsers = useMemo(() => {
    return allUsers.filter(u => !members.some(m => m._id === u._id || m.user === u.username));
  }, [allUsers, members]);

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }
        const data = await response.json();
        setAllUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Notify parent component when members change
  useEffect(() => {
    if (typeof onMembersChange === 'function') {
      onMembersChange(members);
    }
  }, [members, onMembersChange]);

  const handleAddMember = useCallback(() => {
    if (!selectedUser) {
      alert('Please select a user.');
      return;
    }

    const userObject = allUsers.find(u => u.username === selectedUser);
    if (!userObject) {
      alert('Could not find user details.');
      return;
    }

    // Check for duplicate by both _id and username to be extra safe
    const isDuplicate = members.some(member => 
      member._id === userObject._id || 
      member.user === userObject.username
    );
    
    if (isDuplicate) {
      alert('This user is already a member of the project.');
      return;
    }

    const newMember = { 
      _id: userObject._id, 
      user: userObject.username, 
      email: userObject.email, 
      role: selectedRole 
    };
    
    setMembers(prev => [...prev, newMember]);
    setSelectedUser('');
    setSelectedRole('Contributor');
  }, [selectedUser, selectedRole, allUsers, members]);

  const handleRemoveMember = useCallback((memberIdToRemove) => {
    const memberToRemove = members.find(m => m._id === memberIdToRemove);
    
    // Enhanced debugging
    console.log('Attempting to remove member:', memberToRemove);
    console.log('Member role:', memberToRemove?.role);
    console.log('Member user:', memberToRemove?.user);
    console.log('superManager:', superManager);
    
    // Check if member is super manager (fresh check, not using the memoized function)
    const isRemovingSuperManager = memberToRemove && (
      memberToRemove.role === 'Super Manager' || 
      (superManager && memberToRemove.user && 
       memberToRemove.user.trim().toLowerCase() === superManager.trim().toLowerCase())
    );
    
    console.log('Is super manager check (fresh):', isRemovingSuperManager);
    
    if (isRemovingSuperManager) {
      alert('The Super Manager cannot be removed from the project.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }
    
    setMembers(prev => prev.filter(member => member._id !== memberIdToRemove));
  }, [members, superManager]);

  const handleRoleChange = useCallback((memberIdToUpdate, newRole) => {
    setMembers(prev => prev.map(member => 
      member._id === memberIdToUpdate ? { ...member, role: newRole } : member
    ));
  }, []);

  const sendNotificationEmail = async (user, projectName) => {
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          subject: `You've been added to the project: ${projectName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Welcome to ${projectName}!</h2>
              <p>Hi ${user.username},</p>
              <p>You have been added to the project <strong>${projectName}</strong> on Upcheck.</p>
              <p>You can now access the project and its tasks through your dashboard.</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Thank you,<br/>
                The Upcheck Team
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`Failed to send notification to ${user.email}:`, error);
      return { success: false, error: error.message };
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setEmailStatus({});
    
    try {
      // Identify new members
      const originalMembers = (initialMembers || []).map(m => m.user);
      const newMembers = members.filter(m => !originalMembers.includes(m.user));

      // Send notifications to new members if enabled
      if (notifyNewMembers && newMembers.length > 0) {
        const usersToNotify = allUsers.filter(u => 
          newMembers.some(nm => nm.user === u.username)
        );
        
        const emailPromises = usersToNotify.map(async (user) => {
          const result = await sendNotificationEmail(user, project?.name || 'Unknown Project');
          return { user: user.username, ...result };
        });

        const emailResults = await Promise.all(emailPromises);
        
        // Update email status for UI feedback
        const statusMap = {};
        emailResults.forEach(result => {
          statusMap[result.user] = result.success;
        });
        setEmailStatus(statusMap);
      }

      // Update members (this would typically trigger a parent component update)
      if (typeof onMembersChange === 'function') {
        onMembersChange(members);
      }

      // Show success message
      alert('Members updated successfully!');
    } catch (error) {
      console.error('Error saving members:', error);
      alert(`Error saving members: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Fixed isSuperManager function with better debugging and string comparison
  const isSuperManager = useCallback((member) => {
    if (!member) return false;
    
    // Check if role is explicitly "Super Manager"
    const isRoleSuperManager = member.role === 'Super Manager';
    
    // Check if user matches superManager (with trimming and case-insensitive comparison)
    const isUserSuperManager = superManager && member.user && 
      member.user.trim().toLowerCase() === superManager.trim().toLowerCase();
    
    const result = isRoleSuperManager || isUserSuperManager;
    
    // Debug logging
    console.log(`isSuperManager check for ${member.user}:`, {
      memberRole: member.role,
      memberUser: member.user,
      superManager: superManager,
      isRoleSuperManager,
      isUserSuperManager,
      result
    });
    
    return result;
  }, [superManager]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Project Members</h3>
        <span className="text-sm text-gray-500">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Debug info - remove this in production */}
      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
        <strong>Debug Info:</strong> superManager = "{superManager}"
      </div>
      
      {/* Add new member form */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Member</h4>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={availableUsers.length === 0}
            >
              <option value="" disabled>
                {availableUsers.length === 0 ? 'No users available' : 'Select a user to add'}
              </option>
              {availableUsers.map(user => (
                <option key={user._id} value={user.username}>
                  {user.username} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {projectRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddMember}
            disabled={!selectedUser || availableUsers.length === 0}
            className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
            title="Add member"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Settings and Save */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-3">
          <input
            id="notify-members"
            type="checkbox"
            checked={notifyNewMembers}
            onChange={(e) => setNotifyNewMembers(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="notify-members" className="flex items-center text-sm text-gray-700">
            <Mail className="h-4 w-4 mr-2" />
            Notify new members by email
          </label>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* List of current members */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Current Members</h4>
        {members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No members added yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member, idx) => (
              <div 
                key={member._id || member.user || idx} 
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  isSuperManager(member) 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <p className={`font-medium ${
                      isSuperManager(member) ? 'text-blue-700' : 'text-gray-800'
                    }`}>
                      {member.user}
                      {isSuperManager(member) && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Super Manager
                        </span>
                      )}
                    </p>
                    {emailStatus[member.user] !== undefined && (
                      <div className="ml-2">
                        {emailStatus[member.user] ? (
                          <span className="text-green-600 text-xs" title="Email sent successfully">
                            ✓
                          </span>
                        ) : (
                          <span className="text-red-600 text-xs" title="Email failed to send">
                            ✗
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <select 
                    value={member.role} 
                    onChange={(e) => handleRoleChange(member._id, e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSuperManager(member)}
                  >
                    {isSuperManager(member) ? (
                      <option value="Super Manager">Super Manager</option>
                    ) : (
                      projectRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))
                    )}
                  </select>
                  
                  <button 
                    type="button" 
                    onClick={() => handleRemoveMember(member._id)} 
                    disabled={isSuperManager(member)}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded transition-colors"
                    title={isSuperManager(member) ? 'Cannot remove Super Manager' : 'Remove member'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageMembersForm;