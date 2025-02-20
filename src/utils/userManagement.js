// src/utils/userManagement.js

// Department definitions
export const departments = [
    'Development',
    'Testing',
    'Content',
    'Marketing',
    'Operations',
    'Unassigned'
  ];
  
  // Role hierarchy and permissions
  export const roleHierarchy = {
    'Console admin': {
      level: 0, // Highest level
      canManage: ['Console admin','Admin', 'CMS admin', 'Member', 'Mentee'],
      perms: ['console.manage', 'users.manage', 'content.modify', 'department.manage']
    },
    'Admin': {
      level: 1,
      canManage: ['CMS admin', 'Member', 'Mentee'],
      perms: ['users.manage', 'content.modify', 'department.assign']
    },
    'CMS admin': {
      level: 2,
      canManage: [],
      perms: ['content.modify']
    },
    'Member': {
      level: 3,
      canManage: [],
      perms: []
    },
    'Mentee': {
      level: 4,
      canManage: [],
      perms: []
    }
  };
  
  // Permission checking utilities
  export const canManageUser = (currentUser, targetUser) => {
    if (!currentUser || !targetUser) return false;
    
    const currentRole = roleHierarchy[currentUser.role];
    const targetRole = roleHierarchy[targetUser.role];
    
    if (!currentRole || !targetRole) return false;
    
    // Can only manage users of lower level roles
    return currentRole.level < targetRole.level;
  };
  
  export const canManageDepartment = (userRole) => {
    const role = roleHierarchy[userRole];
    return role?.perms.includes('department.manage') || role?.perms.includes('department.assign');
  };
  
  export const getAvailableRoles = (currentUserRole) => {
    const role = roleHierarchy[currentUserRole];
    if (!role) return [];
    return role.canManage;
  };
  
  export const hasPermission = (userRole, permission) => {
    const role = roleHierarchy[userRole];
    return role?.perms.includes(permission) || false;
  };
  
  // Form validation
  export const validateUserData = (userData, isNewUser = true) => {
    const errors = {};
    
    if (!userData.username?.trim()) {
      errors.username = 'Username is required';
    }
    
    if (isNewUser && !userData.password?.trim()) {
      errors.password = 'Password is required';
    }
    
    if (!userData.role) {
      errors.role = 'Role is required';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
  
  // Filter utilities
  export const filterUsers = (users, filters) => {
    return users.filter(user => {
      const matchesSearch = !filters.search || 
        user.username.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.role.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.department?.toLowerCase().includes(filters.search.toLowerCase());
        
      const matchesDepartment = !filters.department || 
        user.department === filters.department;
        
      const matchesRole = !filters.role || 
        user.role === filters.role;
        
      return matchesSearch && matchesDepartment && matchesRole;
    });
  };