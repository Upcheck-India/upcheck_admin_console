/**
 * Data Room Permission Checker
 * Handles granular access control for folders, documents, and rooms
 */

import clientPromise from '../mongodb';
import { ObjectId } from 'mongodb';

// Permission levels (ordered by privilege)
export const PERMISSION_LEVELS = {
  NONE: 0,
  VIEW: 1,
  COMMENT: 2,
  EDIT: 3,
  DOWNLOAD: 4,
  PRINT: 5,
  ADMIN: 10,
};

// Permission types
export const PERMISSION_TYPES = ['view', 'comment', 'edit', 'download', 'print', 'admin'];

/**
 * Check if a user has a specific permission on a resource
 * @param {Object} params - Check parameters
 * @param {Object} params.user - User object
 * @param {string} params.resourceType - 'folder', 'document', or 'room'
 * @param {string} params.resourceId - Resource ID
 * @param {string} params.permission - Permission to check
 * @param {string} params.roomId - Room ID (optional, for context)
 * @returns {Promise<boolean>} Whether user has permission
 */
export async function hasPermission({
  user,
  resourceType,
  resourceId,
  permission,
  roomId = null,
}) {
  if (!user) return false;
  
  // Admin and Console admin have full access to everything
  if (user.role === 'Admin' || user.role === 'Console admin') {
    return true;
  }
  
  const client = await clientPromise;
  const db = client.db('resources');
  
  // Check direct user permission
  const directPermission = await db.collection('dataroom_permissions').findOne({
    resourceType,
    resourceId: resourceId.toString(),
    $or: [
      { userId: user._id?.toString() || user.id },
      { userEmail: user.email },
    ],
    permissions: permission,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });
  
  if (directPermission) return true;
  
  // Check group permissions
  const userGroups = await db.collection('dataroom_user_groups')
    .find({
      $or: [
        { 'members.userId': user._id?.toString() || user.id },
        { 'members.email': user.email },
      ],
    })
    .toArray();
  
  if (userGroups.length > 0) {
    const groupIds = userGroups.map(g => g._id.toString());
    const groupPermission = await db.collection('dataroom_permissions').findOne({
      resourceType,
      resourceId: resourceId.toString(),
      groupId: { $in: groupIds },
      permissions: permission,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    });
    
    if (groupPermission) return true;
  }
  
  // Check inherited permissions (folder → document)
  if (resourceType === 'document') {
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(resourceId),
    });
    
    if (document?.folderId) {
      return hasPermission({
        user,
        resourceType: 'folder',
        resourceId: document.folderId.toString(),
        permission,
        roomId: document.roomId?.toString(),
      });
    }
  }
  
  // Check room-level permissions
  if (roomId) {
    const roomPermission = await db.collection('dataroom_permissions').findOne({
      resourceType: 'room',
      resourceId: roomId.toString(),
      $or: [
        { userId: user._id?.toString() || user.id },
        { userEmail: user.email },
      ],
      permissions: permission,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    });
    
    if (roomPermission) return true;
  }
  
  return false;
}

/**
 * Get all permissions for a resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @returns {Promise<Array>} Array of permission records
 */
export async function getResourcePermissions(resourceType, resourceId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const permissions = await db.collection('dataroom_permissions')
    .find({
      resourceType,
      resourceId: resourceId.toString(),
    })
    .toArray();
  
  return permissions;
}

/**
 * Grant permission to a user or group
 * @param {Object} params - Grant parameters
 * @returns {Promise<Object>} Created permission record
 */
export async function grantPermission({
  resourceType,
  resourceId,
  roomId = null,
  userId = null,
  userEmail = null,
  groupId = null,
  permissions = [],
  expiresAt = null,
  grantedBy,
}) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const permissionDoc = {
    resourceType,
    resourceId: resourceId.toString(),
    roomId: roomId?.toString() || null,
    userId: userId?.toString() || null,
    userEmail: userEmail || null,
    groupId: groupId?.toString() || null,
    permissions,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    grantedBy: {
      id: grantedBy._id?.toString() || grantedBy.id,
      email: grantedBy.email,
    },
    grantedAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Upsert to avoid duplicates
  const result = await db.collection('dataroom_permissions').updateOne(
    {
      resourceType,
      resourceId: resourceId.toString(),
      $or: [
        { userId: userId?.toString() },
        { userEmail: userEmail },
        { groupId: groupId?.toString() },
      ].filter(Boolean),
    },
    {
      $set: permissionDoc,
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  
  return { ...permissionDoc, _id: result.upsertedId };
}

/**
 * Revoke permission
 * @param {string} permissionId - Permission record ID
 * @returns {Promise<boolean>} Success status
 */
export async function revokePermission(permissionId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const result = await db.collection('dataroom_permissions').deleteOne({
    _id: new ObjectId(permissionId),
  });
  
  return result.deletedCount > 0;
}

/**
 * Check if user can access a room (including NDA check)
 * @param {Object} user - User object
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} Access status and details
 */
export async function checkRoomAccess(user, roomId) {
  if (!user || !roomId) {
    return { allowed: false, reason: 'Invalid user or room' };
  }
  
  // Admins always have access
  if (user.role === 'Admin' || user.role === 'Console admin') {
    return { allowed: true, isAdmin: true };
  }
  
  const client = await clientPromise;
  const db = client.db('resources');
  
  const room = await db.collection('dataroom_rooms').findOne({
    _id: new ObjectId(roomId),
  });
  
  if (!room) {
    return { allowed: false, reason: 'Room not found' };
  }
  
  // Check if room is expired
  if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
    return { allowed: false, reason: 'Room has expired' };
  }
  
  // Check if room is locked
  if (room.isLocked) {
    return { allowed: false, reason: 'Room is locked' };
  }
  
  // Check if user is owner
  if (room.ownerId === user._id?.toString() || room.ownerId === user.id) {
    return { allowed: true, isOwner: true };
  }
  
  // Check permission
  const hasAccess = await hasPermission({
    user,
    resourceType: 'room',
    resourceId: roomId,
    permission: 'view',
  });
  
  if (!hasAccess) {
    return { allowed: false, reason: 'No access permission' };
  }
  
  // Check NDA requirement
  if (room.requireNda) {
    const signature = await db.collection('dataroom_signatures').findOne({
      roomId: roomId.toString(),
      userId: user._id?.toString() || user.id,
      type: 'nda',
      status: 'signed',
    });
    
    if (!signature) {
      return { allowed: false, reason: 'NDA signature required', requireNda: true };
    }
  }
  
  // Check IP whitelist
  if (room.ipWhitelist && room.ipWhitelist.length > 0) {
    // This would need the request IP to be passed in
    // For now, we'll skip IP check and handle it at the API level
  }
  
  return { allowed: true };
}

/**
 * Get user's accessible rooms
 * @param {Object} user - User object
 * @returns {Promise<Array>} Array of accessible rooms
 */
export async function getUserAccessibleRooms(user) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  // Admins can see all rooms
  if (user.role === 'Admin' || user.role === 'Console admin') {
    return db.collection('dataroom_rooms').find({}).toArray();
  }
  
  // Get rooms where user has permission
  const permissions = await db.collection('dataroom_permissions')
    .find({
      resourceType: 'room',
      $or: [
        { userId: user._id?.toString() || user.id },
        { userEmail: user.email },
      ],
    })
    .toArray();
  
  const roomIds = permissions.map(p => new ObjectId(p.resourceId));
  
  // Also include rooms user owns
  const rooms = await db.collection('dataroom_rooms')
    .find({
      $or: [
        { _id: { $in: roomIds } },
        { ownerId: user._id?.toString() || user.id },
      ],
      isDeleted: { $ne: true },
    })
    .toArray();
  
  return rooms;
}

const permissionChecker = {
  hasPermission,
  getResourcePermissions,
  grantPermission,
  revokePermission,
  checkRoomAccess,
  getUserAccessibleRooms,
  PERMISSION_LEVELS,
  PERMISSION_TYPES,
};

export default permissionChecker;
