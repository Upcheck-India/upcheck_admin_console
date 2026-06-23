'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User, Shield, Star, Users, UserCheck, ChevronDown, ChevronUp, Mail, Info, Award, X } from 'lucide-react';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import AvatarWithStatus from '../../../components/AvatarWithStatus';

const RoleIcon = ({ role }) => {
  switch (role) {
    case 'Super Manager':
      return <Star className="h-5 w-5 text-yellow-500" />;
    case 'Project Manager':
      return <Shield className="h-5 w-5 text-blue-500" />;
    default:
      return <User className="h-5 w-5 text-gray-500" />;
  }
};

const AccessControlInfo = ({ project, allTeams }) => {
  const permSettings = project?.permissionSettings;
  const accessMode = permSettings?.accessMode || 'members_only';

  const getTeamName = (teamId) => {
    const details = permSettings?.allowedTeamsDetails;
    const detailTeam = details?.find(t => t.id === teamId || t._id === teamId || t.id === teamId?.toString());
    if (detailTeam) return detailTeam.name;

    const team = allTeams?.find(t => t._id === teamId || t._id?.toString() === teamId);
    return team ? team.name : `Team (${teamId})`;
  };

  switch (accessMode) {
    case 'roles_based': {
      const allowedRoles = permSettings.allowedRoles || [];
      return (
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl mb-6">
          <div className="flex items-start">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg mr-3 mt-0.5 flex-shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-purple-900 text-sm md:text-base">Role-Based Access Control</h4>
              <p className="text-sm text-purple-700 mt-1">
                Access to this project is managed by role permissions. Users with the following roles can access it:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {allowedRoles.length > 0 ? (
                  allowedRoles.map((role) => (
                    <span key={role} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-purple-500 italic">No roles specified (restrictive mode)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'teams_based': {
      const allowedTeams = permSettings.allowedTeams || [];
      return (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
          <div className="flex items-start">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg mr-3 mt-0.5 flex-shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-emerald-900 text-sm md:text-base">Team-Based Access Control</h4>
              <p className="text-sm text-emerald-700 mt-1">
                Access to this project is managed by team membership. Members of the following teams can access it:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {allowedTeams.length > 0 ? (
                  allowedTeams.map((teamId) => (
                    <span key={teamId} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {getTeamName(teamId)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-emerald-500 italic">No teams specified (restrictive mode)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'members_only':
    default:
      return (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
          <div className="flex items-start">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg mr-3 mt-0.5 flex-shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 text-sm md:text-base">Member-Based Access Control</h4>
              <p className="text-sm text-blue-700 mt-1">
                Only the designated project super manager and explicitly added project team members have access.
              </p>
            </div>
          </div>
        </div>
      );
  }
};

const TeamCard = ({ team, onlineUsernames, userBadgesMap, isManager, onManageBadges }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Team Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-4 bg-gray-50/50 cursor-pointer select-none border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm md:text-base">{team.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {team.lead ? `Led by ${team.lead.firstName || team.lead.username}` : 'No Lead Assigned'} • {team.memberCount || 0} Members
            </p>
          </div>
        </div>
        <div className="text-gray-400 hover:text-gray-600">
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </div>

      {/* Team Lead & Members Detail List */}
      {isOpen && (
        <div className="divide-y divide-gray-100 bg-white">
          {/* Team Lead */}
          {team.lead && (
            <div className="flex items-center justify-between p-3.5 px-6 bg-amber-50/20">
              <div className="flex items-center min-w-0">
                <div className="mr-3">
                  <AvatarWithStatus
                    username={team.lead.username}
                    online={onlineUsernames?.has(team.lead.username)}
                    className="h-8 w-8 text-xs ring-2 ring-amber-100 shadow-sm"
                  />
                </div>
                 <div className="min-w-0">
                   <div className="flex items-center gap-2">
                     <p className="font-semibold text-gray-955 text-sm">
                       {team.lead.firstName ? `${team.lead.firstName} ${team.lead.lastName || ''}` : team.lead.username}
                     </p>
                     {/* Lead Badges */}
                     <div className="flex items-center gap-1 flex-wrap">
                       <div className="flex flex-wrap gap-1">
                         {userBadgesMap?.get(team.lead.username)?.map((badge, idx) => (
                           <span 
                             key={idx} 
                             className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow-sm border text-[10px] cursor-help hover:scale-110 transition-transform animate-fadeIn animate-duration-300" 
                             title={`${badge.name}: ${badge.description}`}
                           >
                             {badge.icon}
                           </span>
                         ))}
                       </div>
                       {isManager && (
                         <button
                           onClick={(e) => { e.stopPropagation(); onManageBadges(team.lead.username); }}
                           className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                           title="Manage Badges"
                         >
                           <Award className="h-3.5 w-3.5 text-gray-500 hover:text-blue-600" />
                         </button>
                       )}
                     </div>
                   </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3 flex-shrink-0" /> {team.lead.email}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                Team Lead
              </span>
            </div>
          )}

          {/* Members */}
          {(!team.members || team.members.length === 0) ? (
            <div className="p-4 text-center text-xs text-gray-400 italic">
              No additional team members listed.
            </div>
          ) : (
            team.members.map((member) => (
              <div key={member._id || member.username} className="flex items-center justify-between p-3.5 px-6 hover:bg-gray-50/30 transition-colors">
                <div className="flex items-center min-w-0">
                  <div className="mr-3">
                    <AvatarWithStatus
                      username={member.username}
                      online={onlineUsernames?.has(member.username)}
                      className="h-8 w-8 text-xs ring-2 ring-blue-50/50"
                    />
                  </div>
                  <div className="min-w-0">
                   <div className="flex items-center gap-2">
                     <p className="font-medium text-gray-955 text-sm">
                       {member.firstName ? `${member.firstName} ${member.lastName || ''}` : member.username}
                     </p>
                     {/* Member Badges */}
                     <div className="flex items-center gap-1 flex-wrap">
                       <div className="flex flex-wrap gap-1">
                         {userBadgesMap?.get(member.username)?.map((badge, idx) => (
                           <span 
                             key={idx} 
                             className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow-sm border text-[10px] cursor-help hover:scale-110 transition-transform animate-fadeIn animate-duration-300" 
                             title={`${badge.name}: ${badge.description}`}
                           >
                             {badge.icon}
                           </span>
                         ))}
                       </div>
                       {isManager && (
                         <button
                           onClick={(e) => { e.stopPropagation(); onManageBadges(member.username); }}
                           className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                           title="Manage Badges"
                         >
                           <Award className="h-3.5 w-3.5 text-gray-500 hover:text-blue-600" />
                         </button>
                       )}
                     </div>
                   </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3 flex-shrink-0" /> {member.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  {member.role || 'Member'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const MembersTab = ({ members = [], superManager, project, allTeams, currentUser }) => {
  const permSettings = project?.permissionSettings;
  const accessMode = permSettings?.accessMode || 'members_only';
  const hasTeams = permSettings?.allowedTeamsDetails && permSettings.allowedTeamsDetails.length > 0;

  const onlineUsers = useOnlineUsers();
  const onlineUsernames = useMemo(() => new Set(onlineUsers.map(u => u.username)), [onlineUsers]);

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [customBadges, setCustomBadges] = useState([]);
  const [selectedUserForBadges, setSelectedUserForBadges] = useState(null);

  const fetchBadges = useCallback(async () => {
    if (!project?._id && !project?.id) return;
    try {
      const res = await fetch(`/api/projects/${project._id || project.id}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data.leaderboard || []);
        setCustomBadges(data.customBadges || []);
      }
    } catch (err) {
      console.error('Failed to load badges for MembersTab', err);
    }
  }, [project]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const userBadgesMap = useMemo(() => {
    const m = new Map();
    leaderboardData.forEach(item => {
      m.set(item.username, item.badges || []);
    });
    return m;
  }, [leaderboardData]);

  const isManager = useMemo(() => {
    if (!currentUser || !project) return false;
    if (currentUser.role === 'Super Manager') return true;
    if (project.superManager === currentUser.username) return true;
    return project.members?.some(m => m.user === currentUser.username && m.role === 'Project Manager') || false;
  }, [currentUser, project]);

  const handleGrantBadge = async (username, badgeId) => {
    try {
      const res = await fetch(`/api/projects/${project._id || project.id}/leaderboard/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username, badgeId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to grant badge');
      }
      await fetchBadges();
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  const handleRevokeBadge = async (username, badgeId) => {
    try {
      const res = await fetch(`/api/projects/${project._id || project.id}/leaderboard/grant`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username, badgeId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to revoke badge');
      }
      await fetchBadges();
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  const [subTab, setSubTab] = useState(accessMode === 'teams_based' && hasTeams ? 'teams' : 'direct');

  return (
    <div className="p-2 md:p-4">
      {/* Access Control Banner */}
      <AccessControlInfo project={project} allTeams={allTeams} />

      {/* Collaboration experience navigation tabs */}
      {hasTeams && (
        <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-lg w-max mb-6 border border-gray-200">
          <button
            onClick={() => setSubTab('direct')}
            className={`flex items-center px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              subTab === 'direct' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Direct Members ({members.length})
          </button>
          <button
            onClick={() => setSubTab('teams')}
            className={`flex items-center px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              subTab === 'teams' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" /> Authorized Teams ({permSettings.allowedTeamsDetails.length})
          </button>
        </div>
      )}

      {subTab === 'direct' ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Project Team</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Explicit Access List
            </span>
          </div>
          
          {!members || members.length === 0 ? (
            <div className="p-8 bg-gray-50 border border-dashed rounded-xl text-center text-gray-500 text-sm">
              No direct members have been added to this project yet.
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-200/80 hover:shadow-md transition-shadow">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="mr-4 flex-shrink-0">
                      <AvatarWithStatus
                        username={member.user}
                        online={onlineUsernames.has(member.user)}
                        className="h-9 w-9 text-sm ring-2 ring-gray-100"
                      />
                    </div>
                     <div className="min-w-0 flex-1">
                       <div className="flex items-center gap-2">
                         <p className={`font-semibold truncate ${member.user === superManager ? 'text-blue-600' : 'text-gray-955'}`}>
                           {member.user}
                         </p>
                          {/* Member Badges */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <div className="flex flex-wrap gap-1">
                              {userBadgesMap.get(member.user)?.map((badge, idx) => (
                                <span 
                                  key={idx} 
                                  className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow-sm border text-[10px] cursor-help hover:scale-110 transition-transform animate-fadeIn animate-duration-300" 
                                  title={`${badge.name}: ${badge.description}`}
                                >
                                  {badge.icon}
                                </span>
                              ))}
                            </div>
                            {isManager && (
                              <button
                                onClick={() => setSelectedUserForBadges(member.user)}
                                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                                title="Manage Badges"
                              >
                                <Award className="h-3.5 w-3.5 text-gray-500 hover:text-blue-600" />
                              </button>
                            )}
                          </div>
                       </div>
                      <p className="text-sm text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" /> {member.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full flex-shrink-0 ml-4 border">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Authorized Teams & Teammates</h3>
            <span className="text-xs text-gray-500 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded font-medium">
              Implicit Team Access
            </span>
          </div>

          <div className="space-y-4">
            {permSettings.allowedTeamsDetails.map((team) => (
              <TeamCard 
                key={team.id} 
                team={team} 
                onlineUsernames={onlineUsernames} 
                userBadgesMap={userBadgesMap} 
                isManager={isManager}
                onManageBadges={setSelectedUserForBadges}
              />
            ))}
          </div>
        </div>
      )}

      {selectedUserForBadges && (
        <ManageBadgesModal
          username={selectedUserForBadges}
          customBadges={customBadges}
          userBadges={userBadgesMap.get(selectedUserForBadges) || []}
          onGrant={handleGrantBadge}
          onRevoke={handleRevokeBadge}
          onClose={() => setSelectedUserForBadges(null)}
        />
      )}
    </div>
  );
};

const ManageBadgesModal = ({ username, customBadges, userBadges, onGrant, onRevoke, onClose }) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const grantedCustom = userBadges.filter(b => b.type === 'custom');
  const availableToGrant = customBadges.filter(cb => !grantedCustom.some(gc => gc.id === cb.id));

  const handleGrant = async () => {
    if (!selectedBadgeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onGrant(username, selectedBadgeId);
      setSelectedBadgeId('');
    } catch (err) {
      setError(err.message || 'Failed to grant badge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (badgeId) => {
    setSubmitting(true);
    setError(null);
    try {
      await onRevoke(username, badgeId);
    } catch (err) {
      setError(err.message || 'Failed to revoke badge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-950 text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              Manage Badges
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Configure custom achievements for @{username}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Current Badges */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Currently Awarded Custom Badges</h4>
            {grantedCustom.length === 0 ? (
              <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">
                No custom badges granted yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {grantedCustom.map((badge, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-150 hover:bg-gray-100/70 transition-colors">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-lg flex-shrink-0" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{badge.icon || '🎖️'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: badge.color }}>{badge.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{badge.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(badge.id)}
                      disabled={submitting}
                      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-md font-semibold transition-colors flex-shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grant New Badge */}
          <div className="pt-5 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Grant a Custom Badge</h4>
            {availableToGrant.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center p-2">
                All custom badges have been granted to this member.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedBadgeId}
                  onChange={(e) => setSelectedBadgeId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={submitting}
                >
                  <option value="">Select a badge...</option>
                  {availableToGrant.map((badge) => (
                    <option key={badge.id} value={badge.id}>
                      {badge.icon} {badge.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGrant}
                  disabled={submitting || !selectedBadgeId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Award
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MembersTab;
