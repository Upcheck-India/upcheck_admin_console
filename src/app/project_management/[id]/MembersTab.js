'use client';

import React, { useState } from 'react';
import { User, Shield, Star, Users, UserCheck, ChevronDown, ChevronUp, Mail, Info } from 'lucide-react';

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

const TeamCard = ({ team }) => {
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
                <div className="mr-3 p-1.5 bg-amber-100/70 text-amber-700 rounded-full flex-shrink-0 border border-amber-200/50">
                  <Star className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-955 text-sm">
                    {team.lead.firstName ? `${team.lead.firstName} ${team.lead.lastName || ''}` : team.lead.username}
                  </p>
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
                  <div className="mr-3 w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-955 text-sm">
                      {member.firstName ? `${member.firstName} ${member.lastName || ''}` : member.username}
                    </p>
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

const MembersTab = ({ members = [], superManager, project, allTeams }) => {
  const permSettings = project?.permissionSettings;
  const accessMode = permSettings?.accessMode || 'members_only';
  const hasTeams = permSettings?.allowedTeamsDetails && permSettings.allowedTeamsDetails.length > 0;

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
                      <RoleIcon role={member.role} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold truncate ${member.user === superManager ? 'text-blue-600' : 'text-gray-955'}`}>
                        {member.user}
                      </p>
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
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersTab;
