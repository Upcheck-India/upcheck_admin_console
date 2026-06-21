/**
 * Project Permission Utilities
 *
 * Helper functions to check user permissions for project spaces.
 * All permission checks should be performed server-side.
 */

/**
 * Check if user can access a project based on permission settings
 * @param {Object} user - User object with username and role
 * @param {Object} project - Project object with permissionSettings
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional, fetched separately)
 * @returns {boolean} - True if user can access the project
 */
export function canAccessProject(user, project, userTeams = null) {
  if (!user || !project) return false;

  // Admin and Console admin always have access
  if (['Admin', 'Console admin'].includes(user.role)) {
    return true;
  }

  const permSettings = project.permissionSettings;

  // If no permission settings, fall back to members-only behavior
  if (!permSettings || permSettings.accessMode === 'members_only') {
    // Check if user is superManager or a member
    return (
      project.superManager === user.username ||
      (project.members && project.members.some(m => m.user === user.username))
    );
  }

  // Roles-based access mode
  if (permSettings.accessMode === 'roles_based') {
    const allowedRoles = permSettings.allowedRoles || [];

    // If no roles selected, nobody has access (empty = restrictive)
    if (allowedRoles.length === 0) {
      return (
        project.superManager === user.username ||
        (project.members && project.members.some(m => m.user === user.username))
      );
    }

    // Check if "Everyone" is selected (all internal roles)
    const everyoneSelected = allowedRoles.includes('Everyone');
    if (everyoneSelected) {
      return true;
    }

    // Check if user's role is in allowed roles
    if (allowedRoles.includes(user.role)) {
      return true;
    }

    // Check if user is a member (members always have access)
    if (project.members && project.members.some(m => m.user === user.username)) {
      return true;
    }
  }

  // Teams-based access mode
  if (permSettings.accessMode === 'teams_based') {
    const allowedTeams = permSettings.allowedTeams || [];

    // If no teams selected, only members have access
    if (allowedTeams.length === 0) {
      return (
        project.superManager === user.username ||
        (project.members && project.members.some(m => m.user === user.username))
      );
    }

    // Check if user belongs to any allowed team
    if (userTeams && userTeams.length > 0) {
      const userTeamIds = userTeams.map(t => t._id?.toString() || t);
      if (allowedTeams.some(teamId => userTeamIds.includes(teamId))) {
        return true;
      }
    }

    // Check if user is a member (members always have access)
    if (project.members && project.members.some(m => m.user === user.username)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the permission level for a user in a project
 * @param {Object} user - User object with username and role
 * @param {Object} project - Project object with permissionSettings
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {Object} - { level, readScope, writeScope, downloadScope } or null if no access
 */
export function getUserPermissionLevel(user, project, userTeams = null) {
  if (!user || !project) return null;

  // Admin and Console admin have full access
  if (['Admin', 'Console admin'].includes(user.role)) {
    return {
      level: 'full',
      readScope: 'all',
      writeScope: 'all',
      downloadScope: 'all'
    };
  }

  // Check if user is Super Manager
  if (project.superManager === user.username) {
    return {
      level: 'full',
      readScope: 'all',
      writeScope: 'all',
      downloadScope: 'all'
    };
  }

  // Check if user is a Project Manager
  if (project.members && project.members.some(m => m.user === user.username && m.role === 'Project Manager')) {
    return {
      level: 'full',
      readScope: 'all',
      writeScope: 'all',
      downloadScope: 'all'
    };
  }

  const permSettings = project.permissionSettings;

  // If no permission settings or members_only, check membership
  if (!permSettings || permSettings.accessMode === 'members_only') {
    const member = project.members?.find(m => m.user === user.username);
    if (member) {
      // Members get permissions based on their project role
      const projectRolePermissions = {
        'Project Manager': { level: 'full', readScope: 'all', writeScope: 'all', downloadScope: 'all' },
        'Contributor': { level: 'write', readScope: 'all', writeScope: 'own', downloadScope: 'own' },
        'Viewer': { level: 'read', readScope: 'all', writeScope: 'none', downloadScope: 'own' }
      };
      return projectRolePermissions[member.role] || { level: 'read', readScope: 'own', writeScope: 'none', downloadScope: 'none' };
    }
    return null;
  }

  // Roles-based access mode
  if (permSettings.accessMode === 'roles_based') {
    const rolePermissions = permSettings.rolePermissions || {};
    const allowedRoles = permSettings.allowedRoles || [];

    // Check if user's role has specific permissions set
    if (rolePermissions[user.role]) {
      const perms = { ...rolePermissions[user.role] };
      if (!perms.level) {
        if (perms.readScope === 'all' && perms.writeScope === 'all' && perms.downloadScope === 'all') {
          perms.level = 'full';
        } else if (perms.writeScope === 'all' || perms.writeScope === 'own') {
          perms.level = 'write';
        } else {
          perms.level = 'read';
        }
      }
      return perms;
    }

    // Check if "Everyone" is selected - use default permissions
    if (allowedRoles.includes('Everyone')) {
      return {
        level: 'read',
        readScope: 'own',
        writeScope: 'none',
        downloadScope: 'own'
      };
    }

    // User is a member - use member permissions
    const member = project.members?.find(m => m.user === user.username);
    if (member) {
      const projectRolePermissions = {
        'Project Manager': { level: 'full', readScope: 'all', writeScope: 'all', downloadScope: 'all' },
        'Contributor': { level: 'write', readScope: 'all', writeScope: 'own', downloadScope: 'own' },
        'Viewer': { level: 'read', readScope: 'all', writeScope: 'none', downloadScope: 'own' }
      };
      return projectRolePermissions[member.role] || { level: 'read', readScope: 'own', writeScope: 'none', downloadScope: 'none' };
    }
  }

  // Teams-based access mode
  if (permSettings.accessMode === 'teams_based') {
    const teamPermissions = permSettings.teamPermissions || {};
    const allowedTeams = permSettings.allowedTeams || [];

    // Check if user belongs to any allowed team
    if (userTeams && userTeams.length > 0) {
      const userTeamIds = userTeams.map(t => t._id?.toString() || t);
      for (const teamId of allowedTeams) {
        if (userTeamIds.includes(teamId)) {
          // Return team-specific permissions or default
          if (teamPermissions[teamId]) {
            const perms = { ...teamPermissions[teamId] };
            if (!perms.level) {
              if (perms.readScope === 'all' && perms.writeScope === 'all' && perms.downloadScope === 'all') {
                perms.level = 'full';
              } else if (perms.writeScope === 'all' || perms.writeScope === 'own') {
                perms.level = 'write';
              } else {
                perms.level = 'read';
              }
            }
            return perms;
          }
          // Default team member permissions
          return {
            level: 'write',
            readScope: 'all',
            writeScope: 'all',
            downloadScope: 'all'
          };
        }
      }
    }

    // User is a member - use member permissions
    const member = project.members?.find(m => m.user === user.username);
    if (member) {
      const projectRolePermissions = {
        'Project Manager': { level: 'full', readScope: 'all', writeScope: 'all', downloadScope: 'all' },
        'Contributor': { level: 'write', readScope: 'all', writeScope: 'own', downloadScope: 'own' },
        'Viewer': { level: 'read', readScope: 'all', writeScope: 'none', downloadScope: 'own' }
      };
      return projectRolePermissions[member.role] || { level: 'read', readScope: 'own', writeScope: 'none', downloadScope: 'none' };
    }
  }

  return null;
}

/**
 * Check if user can read a file
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @param {Object} file - File/resource object with ownerId or createdBy
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {boolean}
 */
export function canReadFile(user, project, file, userTeams = null) {
  const perms = getUserPermissionLevel(user, project, userTeams);
  if (!perms) return false;

  // Full access can read everything
  if (perms.level === 'full') return true;

  // Check read scope
  if (perms.readScope === 'all') return true;
  if (perms.readScope === 'own') {
    // Check if file belongs to user
    return file.ownerId === user._id?.toString() ||
           file.createdBy === user.username ||
           file.createdBy === user._id?.toString();
  }

  return false;
}

/**
 * Check if user can write/modify a file
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @param {Object} file - File/resource object
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {boolean}
 */
export function canWriteFile(user, project, file, userTeams = null) {
  const perms = getUserPermissionLevel(user, project, userTeams);
  if (!perms) return false;

  // Full access can write to everything
  if (perms.level === 'full') return true;

  // Read-only users cannot write
  if (perms.level === 'read') return false;

  // Check write scope
  if (perms.writeScope === 'all') return true;
  if (perms.writeScope === 'own') {
    return file.ownerId === user._id?.toString() ||
           file.createdBy === user.username ||
           file.createdBy === user._id?.toString();
  }

  return false;
}

/**
 * Check if user can download a file
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @param {Object} file - File/resource object
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {boolean}
 */
export function canDownloadFile(user, project, file, userTeams = null) {
  const perms = getUserPermissionLevel(user, project, userTeams);
  if (!perms) return false;

  // Full access can download everything
  if (perms.level === 'full') return true;

  // Check download scope
  if (perms.downloadScope === 'all') return true;
  if (perms.downloadScope === 'own') {
    return file.ownerId === user._id?.toString() ||
           file.createdBy === user.username ||
           file.createdBy === user._id?.toString();
  }

  // downloadScope === 'none' or anything else
  return false;
}

/**
 * Check if user can delete a file
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @param {Object} file - File/resource object
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {boolean}
 */
export function canDeleteFile(user, project, file, userTeams = null) {
  const perms = getUserPermissionLevel(user, project, userTeams);
  if (!perms) return false;

  // Full access can delete everything
  if (perms.level === 'full') return true;

  // Write access with 'all' scope can delete
  if (perms.level === 'write' && perms.writeScope === 'all') return true;

  // Otherwise can only delete own files
  if (perms.level === 'write' || perms.level === 'full') {
    return file.ownerId === user._id?.toString() ||
           file.createdBy === user.username ||
           file.createdBy === user._id?.toString();
  }

  return false;
}

/**
 * Check if user can create files/folders in a project
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {boolean}
 */
export function canCreateInProject(user, project, userTeams = null) {
  const perms = getUserPermissionLevel(user, project, userTeams);
  if (!perms) return false;

  // Full and write access can create
  return perms.level === 'full' || perms.level === 'write';
}

/**
 * Check if user can manage project permissions
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @param {Array} userTeams - Array of team IDs the user belongs to (optional)
 * @returns {boolean}
 */
export function canManagePermissions(user, project, userTeams = null) {
  if (!user || !project) return false;

  // Admin and Console admin can always manage
  if (['Admin', 'Console admin'].includes(user.role)) {
    return true;
  }

  // Super Manager can manage
  if (project.superManager === user.username) {
    return true;
  }

  // Check permission settings for custom managers
  const permSettings = project.permissionSettings;
  if (permSettings?.managedBy?.includes('projectManager')) {
    // Check if user is a Project Manager
    if (project.members?.some(m => m.user === user.username && m.role === 'Project Manager')) {
      return true;
    }
  }

  // Check if they have full access via teams or roles
  const perms = getUserPermissionLevel(user, project, userTeams);
  if (perms?.level === 'full') {
    return true;
  }

  // By default, only Super Manager and admin roles can manage
  return false;
}

/**
 * Get the list of roles available to select for permissions
 * @returns {string[]} - Array of role names
 */
export function getAvailableRoles() {
  return ['Console admin', 'Admin', 'Member', 'Intern'];
}

/**
 * Get default permission settings for a new project
 * @returns {Object} - Default permission settings
 */
export function getDefaultPermissionSettings() {
  return {
    accessMode: 'members_only',
    allowedRoles: [],
    rolePermissions: {},
    allowedTeams: [],
    teamPermissions: {},
    managedBy: ['superManager', 'projectManager']
  };
}

/**
 * Get available access modes
 * @returns {Array} - Array of access mode options
 */
export function getAccessModes() {
  return [
    { value: 'members_only', label: 'Members Only', description: 'Only project members can access' },
    { value: 'roles_based', label: 'Role-Based', description: 'Users with specific organization roles' },
    { value: 'teams_based', label: 'Team-Based', description: 'Users in specific teams' },
  ];
}

/**
 * Get default permissions for General space
 * Interns: no access by default
 * Members: read, write, download own files only
 * Admin/Console admin: full access (locked)
 * @returns {Object} - Default General space permissions
 */
export function getGeneralSpaceDefaultPermissions() {
  return {
    accessMode: 'roles_based',
    allowedRoles: ['Console admin', 'Admin', 'Member'],
    rolePermissions: {
      'Console admin': { readScope: 'all', writeScope: 'all', downloadScope: 'all' },
      'Admin': { readScope: 'all', writeScope: 'all', downloadScope: 'all' },
      'Member': { readScope: 'own', writeScope: 'own', downloadScope: 'own' },
      'Intern': { readScope: 'none', writeScope: 'none', downloadScope: 'none' },
    },
    managedBy: ['superManager', 'projectManager'],
  };
}

/**
 * Check if user can access the General space based on permission settings
 * @param {Object} user - User object with username and role
 * @param {Object} permissionSettings - General space permission settings
 * @returns {boolean} - True if user can access the General space
 */
export function canAccessGeneralSpace(user, permissionSettings) {
  if (!user) return false;

  // Admin and Console admin always have access
  if (['Admin', 'Console admin'].includes(user.role)) {
    return true;
  }

  const permSettings = permissionSettings || getGeneralSpaceDefaultPermissions();

  // If members_only mode, only project members can access
  if (permSettings.accessMode === 'members_only') {
    // For General space, "members" means users explicitly granted access
    // This would need to be stored separately
    return false; // By default, no one except admins in members_only mode
  }

  // Roles-based access mode
  if (permSettings.accessMode === 'roles_based') {
    const allowedRoles = permSettings.allowedRoles || [];
    const rolePermissions = permSettings.rolePermissions || {};

    // If "Everyone" is selected, all internal users have access
    if (allowedRoles.includes('Everyone')) {
      return true;
    }

    // Check if user's role is in allowed roles
    if (allowedRoles.includes(user.role)) {
      // Check if the role has at least read access
      const rolePerms = rolePermissions[user.role];
      if (rolePerms && rolePerms.readScope === 'none') {
        return false; // Role is listed but has no read access
      }
      return true;
    }
  }

  return false;
}

/**
 * Get the permission level for a user in the General space
 * @param {Object} user - User object with username and role
 * @param {Object} permissionSettings - General space permission settings
 * @returns {Object} - { readScope, writeScope, downloadScope } or null if no access
 */
export function getGeneralSpacePermissionLevel(user, permissionSettings) {
  if (!user) return null;

  // Admin and Console admin have full access
  if (['Admin', 'Console admin'].includes(user.role)) {
    return {
      readScope: 'all',
      writeScope: 'all',
      downloadScope: 'all'
    };
  }

  const permSettings = permissionSettings || getGeneralSpaceDefaultPermissions();

  // If members_only mode, check membership (not applicable for General space by default)
  if (permSettings.accessMode === 'members_only') {
    return null;
  }

  // Roles-based access mode
  if (permSettings.accessMode === 'roles_based') {
    const rolePermissions = permSettings.rolePermissions || {};
    const allowedRoles = permSettings.allowedRoles || [];

    // Check if user's role has specific permissions set
    if (rolePermissions[user.role]) {
      return rolePermissions[user.role];
    }

    // Check if user's role is allowed but no specific permissions set
    if (allowedRoles.includes(user.role)) {
      // Default to read-only own files
      return {
        readScope: 'own',
        writeScope: 'none',
        downloadScope: 'own'
      };
    }
  }

  return null;
}
