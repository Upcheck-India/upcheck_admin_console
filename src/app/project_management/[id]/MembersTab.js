'use client';

import React from 'react';
import { User, Shield, Star } from 'lucide-react';

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

const MembersTab = ({ members, superManager }) => {
  if (!members || members.length === 0) {
    return <div className="p-6"><p>No members have been added to this project yet.</p></div>;
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Team</h3>
      <div className="space-y-3">
        {members.map((member, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="mr-4">
                <RoleIcon role={member.role} />
              </div>
              <div>
                <p className={`font-semibold ${member.user === superManager ? 'text-blue-600' : 'text-gray-900'}`}>
                  {member.user}
                </p>
                <p className="text-sm text-gray-600">{member.email}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MembersTab;
