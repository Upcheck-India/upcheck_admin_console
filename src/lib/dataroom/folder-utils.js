/**
 * Data Room Folder Utilities
 * Helper functions for folder path management and hierarchy
 */

import clientPromise from '../mongodb';
import { ObjectId } from 'mongodb';

/**
 * Generate folder path from parent
 * @param {string} parentPath - Parent folder path
 * @param {string} folderName - New folder name
 * @returns {string} Full path for the new folder
 */
export function generateFolderPath(parentPath, folderName) {
  if (!parentPath || parentPath === '/') {
    return `/${folderName}`;
  }
  return `${parentPath}/${folderName}`;
}

/**
 * Validate folder name
 * @param {string} name - Folder name to validate
 * @returns {Object} Validation result { valid: boolean, error: string|null }
 */
export function validateFolderName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Folder name is required' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Folder name cannot be empty' };
  }
  
  if (trimmed.length > 255) {
    return { valid: false, error: 'Folder name cannot exceed 255 characters' };
  }
  
  // Disallow path separators and special characters
  const invalidChars = /[\/\\:*?"<>|]/;
  if (invalidChars.test(trimmed)) {
    return { valid: false, error: 'Folder name contains invalid characters (/ \\ : * ? " < > |)' };
  }
  
  // Disallow names that are only dots
  if (/^\.+$/.test(trimmed)) {
    return { valid: false, error: 'Folder name cannot be only dots' };
  }
  
  return { valid: true, error: null, cleanName: trimmed };
}

/**
 * Get folder breadcrumb path
 * @param {string} path - Folder path
 * @returns {Array} Array of breadcrumb items { name, path }
 */
export function getBreadcrumbs(path) {
  if (!path || path === '/') {
    return [{ name: 'Root', path: '/' }];
  }
  
  const parts = path.split('/').filter(Boolean);
  const breadcrumbs = [{ name: 'Root', path: '/' }];
  
  let currentPath = '';
  for (const part of parts) {
    currentPath += `/${part}`;
    breadcrumbs.push({ name: part, path: currentPath });
  }
  
  return breadcrumbs;
}

/**
 * Get folder tree for a room
 * @param {string} roomId - Room ID
 * @returns {Promise<Array>} Hierarchical folder tree
 */
export async function getFolderTree(roomId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const folders = await db.collection('dataroom_folders')
    .find({ roomId: new ObjectId(roomId) })
    .sort({ path: 1 })
    .toArray();
  
  // Build tree structure
  const tree = [];
  const folderMap = new Map();
  
  // First pass: create map
  for (const folder of folders) {
    folderMap.set(folder._id.toString(), {
      ...folder,
      children: [],
    });
  }
  
  // Second pass: build hierarchy
  for (const folder of folders) {
    const node = folderMap.get(folder._id.toString());
    
    if (!folder.parentId) {
      tree.push(node);
    } else {
      const parent = folderMap.get(folder.parentId.toString());
      if (parent) {
        parent.children.push(node);
      } else {
        tree.push(node); // Orphan - add to root
      }
    }
  }
  
  return tree;
}

/**
 * Get all descendant folder IDs
 * @param {string} folderId - Parent folder ID
 * @param {string} roomId - Room ID
 * @returns {Promise<Array>} Array of descendant folder IDs
 */
export async function getDescendantFolderIds(folderId, roomId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const folder = await db.collection('dataroom_folders').findOne({
    _id: new ObjectId(folderId),
  });
  
  if (!folder) return [];
  
  // Find all folders whose path starts with this folder's path
  const descendants = await db.collection('dataroom_folders')
    .find({
      roomId: new ObjectId(roomId),
      path: { $regex: `^${escapeRegex(folder.path)}/` },
    })
    .toArray();
  
  return descendants.map(d => d._id.toString());
}

/**
 * Calculate folder size (sum of all documents in folder and subfolders)
 * @param {string} folderId - Folder ID
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} Size information { totalBytes, documentCount }
 */
export async function calculateFolderSize(folderId, roomId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  // Get this folder and all descendants
  const descendantIds = await getDescendantFolderIds(folderId, roomId);
  const allFolderIds = [folderId, ...descendantIds].map(id => new ObjectId(id));
  
  // Sum up document sizes
  const result = await db.collection('dataroom_documents')
    .aggregate([
      {
        $match: {
          folderId: { $in: allFolderIds },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: '$fileSize' },
          documentCount: { $sum: 1 },
        },
      },
    ])
    .toArray();
  
  return result[0] || { totalBytes: 0, documentCount: 0 };
}

/**
 * Move folder to new parent (updates path for folder and all descendants)
 * @param {string} folderId - Folder to move
 * @param {string} newParentId - New parent folder ID (null for root)
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} Result { success, movedCount }
 */
export async function moveFolder(folderId, newParentId, roomId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const folder = await db.collection('dataroom_folders').findOne({
    _id: new ObjectId(folderId),
  });
  
  if (!folder) {
    return { success: false, error: 'Folder not found' };
  }
  
  // Determine new path
  let newPath;
  let newParentOid = null;
  
  if (newParentId) {
    const newParent = await db.collection('dataroom_folders').findOne({
      _id: new ObjectId(newParentId),
      roomId: new ObjectId(roomId),
    });
    
    if (!newParent) {
      return { success: false, error: 'New parent folder not found' };
    }
    
    // Prevent moving into own descendant
    if (newParent.path.startsWith(folder.path + '/')) {
      return { success: false, error: 'Cannot move folder into its own descendant' };
    }
    
    newPath = generateFolderPath(newParent.path, folder.name);
    newParentOid = new ObjectId(newParentId);
  } else {
    newPath = `/${folder.name}`;
  }
  
  // Check if path already exists
  const existing = await db.collection('dataroom_folders').findOne({
    roomId: new ObjectId(roomId),
    path: newPath,
    _id: { $ne: new ObjectId(folderId) },
  });
  
  if (existing) {
    return { success: false, error: 'A folder with this name already exists at the destination' };
  }
  
  const oldPath = folder.path;
  
  // Update this folder
  await db.collection('dataroom_folders').updateOne(
    { _id: new ObjectId(folderId) },
    {
      $set: {
        path: newPath,
        parentId: newParentOid,
        updatedAt: new Date(),
      },
    }
  );
  
  // Update all descendants
  const descendants = await db.collection('dataroom_folders')
    .find({
      roomId: new ObjectId(roomId),
      path: { $regex: `^${escapeRegex(oldPath)}/` },
    })
    .toArray();
  
  let movedCount = 1;
  
  for (const desc of descendants) {
    const updatedPath = desc.path.replace(oldPath, newPath);
    await db.collection('dataroom_folders').updateOne(
      { _id: desc._id },
      { $set: { path: updatedPath, updatedAt: new Date() } }
    );
    movedCount++;
  }
  
  return { success: true, movedCount, newPath };
}

/**
 * Delete folder and all contents
 * @param {string} folderId - Folder to delete
 * @param {string} roomId - Room ID
 * @param {boolean} permanent - Hard delete vs soft delete
 * @returns {Promise<Object>} Result { success, deletedFolders, deletedDocuments }
 */
export async function deleteFolder(folderId, roomId, permanent = false) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const folder = await db.collection('dataroom_folders').findOne({
    _id: new ObjectId(folderId),
  });
  
  if (!folder) {
    return { success: false, error: 'Folder not found' };
  }
  
  // Get all descendant folders
  const descendantIds = await getDescendantFolderIds(folderId, roomId);
  const allFolderIds = [folderId, ...descendantIds].map(id => new ObjectId(id));
  
  if (permanent) {
    // Hard delete documents
    const docResult = await db.collection('dataroom_documents').deleteMany({
      folderId: { $in: allFolderIds },
    });
    
    // Hard delete folders
    const folderResult = await db.collection('dataroom_folders').deleteMany({
      _id: { $in: allFolderIds },
    });
    
    return {
      success: true,
      deletedFolders: folderResult.deletedCount,
      deletedDocuments: docResult.deletedCount,
    };
  } else {
    // Soft delete
    const now = new Date();
    
    await db.collection('dataroom_documents').updateMany(
      { folderId: { $in: allFolderIds } },
      { $set: { isDeleted: true, deletedAt: now } }
    );
    
    await db.collection('dataroom_folders').updateMany(
      { _id: { $in: allFolderIds } },
      { $set: { isDeleted: true, deletedAt: now } }
    );
    
    return {
      success: true,
      deletedFolders: allFolderIds.length,
      deletedDocuments: 'soft-deleted',
    };
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get folder by path
 * @param {string} roomId - Room ID
 * @param {string} path - Folder path
 * @returns {Promise<Object|null>} Folder document or null
 */
export async function getFolderByPath(roomId, path) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  return db.collection('dataroom_folders').findOne({
    roomId: new ObjectId(roomId),
    path,
  });
}

/**
 * Get direct children of a folder
 * @param {string} folderId - Parent folder ID (null for root)
 * @param {string} roomId - Room ID
 * @returns {Promise<Array>} Array of child folders
 */
export async function getChildFolders(folderId, roomId) {
  const client = await clientPromise;
  const db = client.db('resources');
  
  const query = {
    roomId: new ObjectId(roomId),
    isDeleted: { $ne: true },
  };
  
  if (folderId) {
    query.parentId = new ObjectId(folderId);
  } else {
    query.parentId = null;
  }
  
  return db.collection('dataroom_folders')
    .find(query)
    .sort({ name: 1 })
    .toArray();
}

const folderUtils = {
  generateFolderPath,
  validateFolderName,
  getBreadcrumbs,
  getFolderTree,
  getDescendantFolderIds,
  calculateFolderSize,
  moveFolder,
  deleteFolder,
  getFolderByPath,
  getChildFolders,
};

export default folderUtils;
