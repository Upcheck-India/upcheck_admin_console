// src/utils/roles.js
export const roles = {
    'super-admin': {
      level: 0,
      canManage: ['admin', 'editor', 'viewer'],
      permissions: ['create-user', 'edit-user', 'delete-user', 'manage-content']
    },
    'admin': {
      level: 1,
      canManage: ['editor', 'viewer'],
      permissions: ['edit-user', 'manage-content']
    },
    'editor': {
      level: 2,
      canManage: ['viewer'],
      permissions: ['edit-content']
    },
    'viewer': {
      level: 3,
      canManage: [],
      permissions: []
    }
  };