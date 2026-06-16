'use client';

import React from 'react';
import { User, Shield, Star, Users, UserCheck } from 'lucide-react';

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

const MembersTab = ({ members = [], superManager, project, allTeams }) => {
  return (
    <div className="p-6">
      {/* Access Control Banner */}
      <AccessControlInfo project={project} allTeams={allTeams} />

      <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-6">Project Team</h3>
      
      {!members || members.length === 0 ? (
        <div className="p-4 bg-gray-50 border border-dashed rounded-lg text-center text-gray-500 text-sm">
          No direct members have been added to this project yet.
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border">
              <div className="flex items-center flex-1 min-w-0">
                <div className="mr-4 flex-shrink-0">
                  <RoleIcon role={member.role} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold truncate ${member.user === superManager ? 'text-blue-600' : 'text-gray-900'}`}>
                    {member.user}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{member.email}</p>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full flex-shrink-0 ml-4">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MembersTab;
