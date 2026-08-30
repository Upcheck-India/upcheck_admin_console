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

  // Internal users carry `_id`; external users are normalised to carry `id`.
  const userIdStr = user._id?.toString() || user.id;

  // Check room ownership directly first if roomId is provided
  if (roomId) {
    const room = await db.collection('dataroom_rooms').findOne({
      _id: new ObjectId(roomId)
    });
    
    // If user is the owner of the room, they have full access to everything inside it
    if (room && (room.ownerId === user._id?.toString() || room.ownerId === user.id)) {
      return true;
    }
  }

  // Helper function to check specific resource permutations
  const checkResourcePerms = async (type, id) => {
    // 0. Check if user is the creator/owner of this specific resource
    if (type === 'room') {
      const room = await db.collection('dataroom_rooms').findOne({ _id: new ObjectId(id) });
      if (room && (room.ownerId === user._id?.toString() || room.ownerId === user.id)) return true;
    } else if (type === 'folder') {
      const folder = await db.collection('dataroom_folders').findOne({ _id: new ObjectId(id) });
      if (folder && folder.createdBy && (folder.createdBy.id === user._id?.toString() || folder.createdBy.id === user.id)) return true;
    } else if (type === 'document') {
      const doc = await db.collection('dataroom_documents').findOne({ _id: new ObjectId(id) });
      if (doc && doc.createdBy && (doc.createdBy.id === user._id?.toString() || doc.createdBy.id === user.id)) return true;
    }

    const permsToCheck = permission === 'admin' ? ['admin'] : [permission, 'admin'];

    // 1. Check direct user permission.
    //
    // Both the identity clause and the expiry clause are disjunctions, so they
    // MUST be combined under $and. Writing them as two sibling `$or` keys is
    // valid JavaScript but the second silently overwrites the first, dropping
    // the identity check entirely — which made every document readable by
    // every authenticated account. Do not collapse this back into bare $or
    // keys. See scripts/find-duplicate-query-keys.cjs.
    const directPermission = await db.collection('dataroom_permissions').findOne({
      resourceType: type,
      resourceId: id.toString(),
      permissions: { $in: permsToCheck },
      $and: [
        { $or: [{ userId: userIdStr }, { userEmail: user.email }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      ],
    });

    if (directPermission) return true;

    // 2. Check group permissions
    const userGroups = await db.collection('dataroom_user_groups')
      .find({
        $or: [
          { 'members.userId': userIdStr },
          { 'members.email': user.email },
        ],
      })
      .toArray();

    if (userGroups.length > 0) {
      const groupIds = userGroups.map(g => g._id.toString());
      const groupPermission = await db.collection('dataroom_permissions').findOne({
        resourceType: type,
        resourceId: id.toString(),
        groupId: { $in: groupIds },
        permissions: { $in: permsToCheck },
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      if (groupPermission) return true;
    }

    // 3. Check team permissions
    const userTeams = await db.collection('teams')
      .find({
        $or: [
          { 'members': userIdStr },
          { 'lead': userIdStr },
        ],
      })
      .toArray();

    if (userTeams.length > 0) {
      const teamIds = userTeams.map(t => t._id.toString());
      const teamPermission = await db.collection('dataroom_permissions').findOne({
        resourceType: type,
        resourceId: id.toString(),
        teamId: { $in: teamIds },
        permissions: { $in: permsToCheck },
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      if (teamPermission) return true;
    }

    return false;
  };

  // Hierarchy Evaluation: Document -> Folder -> Room
  // 1. If evaluating a document, check document-level overrides first
  if (resourceType === 'document') {
    const hasDocPerm = await checkResourcePerms('document', resourceId);
    if (hasDocPerm) return true;

    // Fetch the document to find its folder/room context
    const document = await db.collection('dataroom_documents').findOne({
      _id: new ObjectId(resourceId),
    });

    if (!document) return false;

    // 2. Plunge down to Folder check
    if (document.folderId) {
      const hasFolderPerm = await checkResourcePerms('folder', document.folderId);
      if (hasFolderPerm) return true;
    }

    // 3. Plunge down to Room check
    if (document.roomId) {
      const hasRoomPerm = await checkResourcePerms('room', document.roomId);
      if (hasRoomPerm) return true;
    }
  }
  // If evaluating a folder, check folder-level overrides first
  else if (resourceType === 'folder') {
    const hasFolderPerm = await checkResourcePerms('folder', resourceId);
    if (hasFolderPerm) return true;

    // Fetch the folder to find its room context
    const folder = await db.collection('dataroom_folders').findOne({
      _id: new ObjectId(resourceId),
    });

    if (!folder) return false;

    // 2. Plunge down to Room check
    if (folder.roomId) {
      const hasRoomPerm = await checkResourcePerms('room', folder.roomId);
      if (hasRoomPerm) return true;
    }
  }
  // If evaluating a room, just check room-level
  else if (resourceType === 'room' || roomId) {
    const targetRoomId = resourceType === 'room' ? resourceId : roomId;
    const hasRoomPerm = await checkResourcePerms('room', targetRoomId);
    if (hasRoomPerm) return true;
  }

  // Base case: No permission found at any level
  return false;
}

/**
 * Get all permissions for a resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @returns {Promise<Array>} Array of permission records with enriched names
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

  // Enrich permissions with team/group names if not stored
  const enrichedPermissions = await Promise.all(permissions.map(async (perm) => {
    if (perm.teamId && !perm.teamName) {
      const team = await db.collection('teams').findOne({ _id: new ObjectId(perm.teamId) });
      perm.teamName = team?.name || null;
    }
    if (perm.groupId && !perm.groupName) {
      const group = await db.collection('dataroom_user_groups').findOne({ _id: new ObjectId(perm.groupId) });
      perm.groupName = group?.name || null;
    }
    return perm;
  }));

  return enrichedPermissions;
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
  teamId = null,
  permissions = [],
  expiresAt = null,
  grantedBy,
}) {
  const client = await clientPromise;
  const db = client.db('resources');

  // Fetch team name if teamId provided
  let teamName = null;
  if (teamId) {
    const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) });
    teamName = team?.name || null;
  }

  // Fetch group name if groupId provided
  let groupName = null;
  if (groupId) {
    const group = await db.collection('dataroom_user_groups').findOne({ _id: new ObjectId(groupId) });
    groupName = group?.name || null;
  }

  const permissionDoc = {
    resourceType,
    resourceId: resourceId.toString(),
    roomId: roomId?.toString() || null,
    userId: userId?.toString() || null,
    userEmail: userEmail || null,
    groupId: groupId?.toString() || null,
    groupName,
    teamId: teamId?.toString() || null,
    teamName,
    permissions,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    grantedBy: {
      id: grantedBy._id?.toString() || grantedBy.id,
      email: grantedBy.email,
    },
    grantedAt: new Date(),
    updatedAt: new Date(),
  };

  // Build the filter for upsert - handle user/group/team separately
  const filterConditions = [];
  if (userId?.toString()) filterConditions.push({ userId: userId?.toString() });
  if (userEmail) filterConditions.push({ userEmail: userEmail });
  if (groupId?.toString()) filterConditions.push({ groupId: groupId?.toString() });
  if (teamId?.toString()) filterConditions.push({ teamId: teamId?.toString() });

  // Upsert to avoid duplicates
  const result = await db.collection('dataroom_permissions').updateOne(
    {
      resourceType,
      resourceId: resourceId.toString(),
      $or: filterConditions,
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

  // Internal users carry `_id`; external users are normalised to carry `id`.
  const userIdStr = user._id?.toString() || user.id;

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
      userId: userIdStr,
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

  // Internal users carry `_id`; external users are normalised to carry `id`.
  const userIdStr = user._id?.toString() || user.id;

  // Admins can see all rooms
  if (user.role === 'Admin' || user.role === 'Console admin') {
    return db.collection('dataroom_rooms').find({}).toArray();
  }

  // Get user's teams and groups for permission lookup
  const userTeams = await db.collection('teams')
    .find({
      $or: [
        { 'members': userIdStr },
        { 'lead': userIdStr },
      ],
    })
    .toArray();

  const userGroups = await db.collection('dataroom_user_groups')
    .find({
      $or: [
        { 'members.userId': userIdStr },
        { 'members.email': user.email },
      ],
    })
    .toArray();

  // Build array of IDs for permission lookup
  const teamIds = userTeams.map(t => t._id.toString());
  const groupIds = userGroups.map(g => g._id.toString());

  // Get rooms where user has permission (direct, group, or team)
  const permissions = await db.collection('dataroom_permissions')
    .find({
      resourceType: 'room',
      $or: [
        { userId: userIdStr },
        { userEmail: user.email },
        { groupId: { $in: groupIds } },
        { teamId: { $in: teamIds } },
      ],
    })
    .toArray();

  const roomIds = permissions.map(p => new ObjectId(p.resourceId));

  // Also include rooms user owns
  const rooms = await db.collection('dataroom_rooms')
    .find({
      $or: [
        { _id: { $in: roomIds } },
        { ownerId: userIdStr },
      ],
      isDeleted: { $ne: true },
    })
    .toArray();

  return rooms;
}

/**
 * Build a MongoDB filter fragment restricting a `dataroom_documents` query to
 * the documents this user may see.
 *
 * `hasPermission` answers "may this user touch THIS document", which is the
 * wrong shape for a list endpoint — calling it per row is both an N+1 and easy
 * to forget entirely (which is exactly what GET /api/dataroom/documents did:
 * it returned every document in every room to any authenticated account).
 *
 * The fragment mirrors `hasPermission`'s grant semantics, which are additive:
 * a grant at room, folder or document level all admit the document. So a user
 * may see a document when ANY of these hold:
 *   - they can access its room (room-level grant, or they own the room)
 *   - they hold a grant on its folder
 *   - they hold a grant on the document itself
 *   - they created it
 *
 * Returns `null` for callers who may see everything (Admin / Console admin),
 * meaning "apply no restriction".
 *
 * @param {Object} user
 * @returns {Promise<Object|null>} filter fragment, or null for unrestricted
 */
export async function getAccessibleDocumentsFilter(user) {
  if (!user) return { _id: { $in: [] } }; // deny-all rather than allow-all
  if (user.role === 'Admin' || user.role === 'Console admin') return null;

  const client = await clientPromise;
  const db = client.db('resources');
  const userIdStr = user._id?.toString() || user.id;

  const [userTeams, userGroups] = await Promise.all([
    db.collection('teams')
      .find({ $or: [{ members: userIdStr }, { lead: userIdStr }] })
      .project({ _id: 1 })
      .toArray(),
    db.collection('dataroom_user_groups')
      .find({
        $or: [
          { 'members.userId': userIdStr },
          { 'members.email': user.email },
        ],
      })
      .project({ _id: 1 })
      .toArray(),
  ]);

  const teamIds = userTeams.map((t) => t._id.toString());
  const groupIds = userGroups.map((g) => g._id.toString());

  // Every unexpired grant this user holds, at any resource level, in one read.
  const grants = await db.collection('dataroom_permissions')
    .find({
      $and: [
        {
          $or: [
            { userId: userIdStr },
            { userEmail: user.email },
            ...(groupIds.length ? [{ groupId: { $in: groupIds } }] : []),
            ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : []),
          ],
        },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      ],
    })
    .project({ resourceType: 1, resourceId: 1 })
    .toArray();

  const toObjectIds = (type) =>
    grants
      .filter((g) => g.resourceType === type && ObjectId.isValid(g.resourceId))
      .map((g) => new ObjectId(g.resourceId));

  const grantedRoomIds = toObjectIds('room');
  const grantedFolderIds = toObjectIds('folder');
  const grantedDocumentIds = toObjectIds('document');

  // Rooms they own count as accessible even without an explicit grant row.
  const ownedRooms = await db.collection('dataroom_rooms')
    .find({ ownerId: userIdStr, isDeleted: { $ne: true } })
    .project({ _id: 1 })
    .toArray();

  const roomIds = [...grantedRoomIds, ...ownedRooms.map((r) => r._id)];

  const clauses = [];
  if (roomIds.length) clauses.push({ roomId: { $in: roomIds } });
  if (grantedFolderIds.length) clauses.push({ folderId: { $in: grantedFolderIds } });
  if (grantedDocumentIds.length) clauses.push({ _id: { $in: grantedDocumentIds } });
  clauses.push({ 'createdBy.id': userIdStr });

  return { $or: clauses };
}

const permissionChecker = {
  hasPermission,
  getResourcePermissions,
  grantPermission,
  revokePermission,
  checkRoomAccess,
  getUserAccessibleRooms,
  getAccessibleDocumentsFilter,
  PERMISSION_LEVELS,
  PERMISSION_TYPES,
};

export default permissionChecker;
