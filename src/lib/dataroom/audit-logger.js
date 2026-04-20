/**
 * Data Room Audit Logger
 * Provides immutable audit logging for all data room actions
 */

import clientPromise from '../mongodb';

// Action types for audit logging
export const AUDIT_ACTIONS = {
  // Folder actions
  FOLDER_CREATE: 'FOLDER_CREATE',
  FOLDER_RENAME: 'FOLDER_RENAME',
  FOLDER_MOVE: 'FOLDER_MOVE',
  FOLDER_DELETE: 'FOLDER_DELETE',
  
  // Document actions
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_VIEW: 'DOCUMENT_VIEW',
  DOCUMENT_DOWNLOAD: 'DOCUMENT_DOWNLOAD',
  DOCUMENT_PRINT: 'DOCUMENT_PRINT',
  DOCUMENT_EDIT: 'DOCUMENT_EDIT',
  DOCUMENT_DELETE: 'DOCUMENT_DELETE',
  DOCUMENT_MOVE: 'DOCUMENT_MOVE',
  DOCUMENT_LOCK: 'DOCUMENT_LOCK',
  DOCUMENT_UNLOCK: 'DOCUMENT_UNLOCK',
  
  // Version actions
  VERSION_CREATE: 'VERSION_CREATE',
  VERSION_RESTORE: 'VERSION_RESTORE',
  
  // Permission actions
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  PERMISSION_REVOKE: 'PERMISSION_REVOKE',
  PERMISSION_UPDATE: 'PERMISSION_UPDATE',
  
  // Room actions
  ROOM_CREATE: 'ROOM_CREATE',
  ROOM_UPDATE: 'ROOM_UPDATE',
  ROOM_DELETE: 'ROOM_DELETE',
  ROOM_ACCESS: 'ROOM_ACCESS',
  
  // User actions
  USER_INVITE: 'USER_INVITE',
  USER_JOIN: 'USER_JOIN',
  USER_LEAVE: 'USER_LEAVE',
  
  // Q&A actions
  QUESTION_SUBMIT: 'QUESTION_SUBMIT',
  QUESTION_ANSWER: 'QUESTION_ANSWER',
  QUESTION_PUBLISH: 'QUESTION_PUBLISH',
  
  // Signature actions
  NDA_SIGN: 'NDA_SIGN',
  DOCUMENT_SIGN: 'DOCUMENT_SIGN',
  
  // Comment actions
  COMMENT_ADD: 'COMMENT_ADD',
  COMMENT_EDIT: 'COMMENT_EDIT',
  COMMENT_DELETE: 'COMMENT_DELETE',
  
  // Task actions
  TASK_CREATE: 'TASK_CREATE',
  TASK_UPDATE: 'TASK_UPDATE',
  TASK_DELETE: 'TASK_DELETE',
  
  // Access control actions
  PERMISSION_EXPIRY_SET: 'PERMISSION_EXPIRY_SET',
  PERMISSION_EXPIRY_REMOVED: 'PERMISSION_EXPIRY_REMOVED',
  IP_WHITELIST_CONFIGURED: 'IP_WHITELIST_CONFIGURED',
  ACCESS_REQUESTED: 'ACCESS_REQUESTED',
  ACCESS_APPROVED: 'ACCESS_APPROVED',
  ACCESS_REJECTED: 'ACCESS_REJECTED',
  
  // Party/Bidder actions
  PARTY_CREATED: 'PARTY_CREATED',
  PARTY_UPDATED: 'PARTY_UPDATED',
  PARTY_DELETED: 'PARTY_DELETED',
  
  // Workflow actions
  WORKFLOW_CREATED: 'WORKFLOW_CREATED',
  WORKFLOW_APPROVED: 'WORKFLOW_APPROVED',
  WORKFLOW_REJECTED: 'WORKFLOW_REJECTED',
  
  // Bulk operations
  DOCUMENT_BULK_UPLOAD: 'DOCUMENT_BULK_UPLOAD',
  DOCUMENT_UPLOAD_BLOCKED: 'DOCUMENT_UPLOAD_BLOCKED',
  
  // Branding actions
  ROOM_BRANDING_UPDATED: 'ROOM_BRANDING_UPDATED',
  
  // State actions
  DOCUMENT_STATE_CHANGE: 'DOCUMENT_STATE_CHANGE',
  
  // Metadata actions
  METADATA_TEMPLATE_CREATE: 'METADATA_TEMPLATE_CREATE',
  METADATA_TEMPLATE_UPDATE: 'METADATA_TEMPLATE_UPDATE',
  METADATA_TEMPLATE_DELETE: 'METADATA_TEMPLATE_DELETE',
};

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - Action type from AUDIT_ACTIONS
 * @param {string} params.resourceType - Type of resource (folder, document, room, etc.)
 * @param {string} params.resourceId - ID of the resource
 * @param {string} params.roomId - Room ID (if applicable)
 * @param {Object} params.user - User performing the action
 * @param {Object} params.details - Additional details about the action
 * @param {Object} params.request - Request object for IP/user-agent extraction
 * @returns {Promise<Object>} The inserted audit log document
 */
export async function logAudit({
  action,
  resourceType,
  resourceId,
  roomId = null,
  user,
  details = {},
  request = null,
}) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    
    const auditEntry = {
      action,
      resourceType,
      resourceId: resourceId?.toString() || null,
      roomId: roomId?.toString() || null,
      userId: user?._id?.toString() || user?.id || null,
      userEmail: user?.email || null,
      userName: user?.username || user?.name || null,
      userRole: user?.role || null,
      userType: user?.isExternal ? 'external' : 'internal',
      details,
      timestamp: new Date(),
      ip: request?.headers?.get?.('x-forwarded-for') || 
          request?.headers?.get?.('x-real-ip') || 
          'unknown',
      userAgent: request?.headers?.get?.('user-agent') || 'unknown',
      // Checksum for tamper detection (simple implementation)
      checksum: generateChecksum({
        action,
        resourceId,
        userId: user?._id?.toString(),
        timestamp: Date.now(),
      }),
    };
    
    const result = await db.collection('dataroom_audit_log').insertOne(auditEntry);
    return { ...auditEntry, _id: result.insertedId };
  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't throw - audit logging should not break main operations
    return null;
  }
}

/**
 * Generate a simple checksum for tamper detection
 */
function generateChecksum(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Query audit logs with filters
 * @param {Object} filters - Query filters
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<Array>} Array of audit log entries
 */
export async function queryAuditLogs(filters = {}, options = {}) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
  
  const query = {};
  
  if (filters.action) query.action = filters.action;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.resourceId) query.resourceId = filters.resourceId;
  if (filters.roomId) query.roomId = filters.roomId;
  if (filters.userId) query.userId = filters.userId;
  if (filters.userEmail) query.userEmail = filters.userEmail;
  if (filters.fromDate) query.timestamp = { $gte: new Date(filters.fromDate) };
  if (filters.toDate) {
    query.timestamp = query.timestamp || {};
    query.timestamp.$lte = new Date(filters.toDate);
  }
  
  const logs = await db.collection('dataroom_audit_log')
    .find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();
  
  return logs;
}

/**
 * Get user activity summary
 * @param {string} userId - User ID
 * @param {string} roomId - Optional room ID filter
 * @returns {Promise<Object>} Activity summary
 */
export async function getUserActivitySummary(userId, roomId = null) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const match = { userId };
  if (roomId) match.roomId = roomId;
  
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' },
      },
    },
    { $sort: { count: -1 } },
  ];
  
  const summary = await db.collection('dataroom_audit_log')
    .aggregate(pipeline)
    .toArray();
  
  return summary;
}

export default { logAudit, queryAuditLogs, getUserActivitySummary, AUDIT_ACTIONS };
