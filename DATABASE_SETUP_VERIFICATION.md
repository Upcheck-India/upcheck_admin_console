# Data Room Database Setup Verification

**Date:** February 22, 2026  
**Database:** MongoDB (`resources` database)

---

## ✅ Required Collections

All collections are created via MongoDB MCP server or automatically by API on first use.

### **Core Collections**

1. **`dataroom_rooms`**
   - Purpose: VDR room definitions
   - Indexes: `{ isDeleted: 1 }`, `{ createdBy.id: 1 }`
   - Sample fields: `name`, `type`, `status`, `settings`, `branding`

2. **`dataroom_folders`**
   - Purpose: Hierarchical folder structure
   - Indexes: `{ roomId: 1 }`, `{ parentId: 1 }`, `{ isDeleted: 1 }`
   - Sample fields: `name`, `roomId`, `parentId`, `path`, `permissions`

3. **`dataroom_documents`**
   - Purpose: Document metadata
   - Indexes: `{ roomId: 1 }`, `{ folderId: 1 }`, `{ fileId: 1 }`, `{ isDeleted: 1 }`
   - Sample fields: `name`, `fileId`, `fileName`, `mimeType`, `fileSize`, `version`
   - **Note:** Multiple documents can reference same `fileId` (for copy/move without duplication)

4. **`dataroom_versions`**
   - Purpose: Document version history
   - Indexes: `{ documentId: 1 }`, `{ versionNumber: 1 }`
   - Sample fields: `documentId`, `versionNumber`, `fileId`, `changes`, `createdBy`

### **Access Control Collections**

5. **`dataroom_permissions`**
   - Purpose: Granular permissions
   - Indexes: `{ resourceType: 1, resourceId: 1 }`, `{ userId: 1 }`
   - Sample fields: `resourceType`, `resourceId`, `userId`, `permissions`, `expiresAt`

6. **`dataroom_user_groups`**
   - Purpose: User groups for batch permission management
   - Indexes: `{ name: 1 }`
   - Sample fields: `name`, `description`, `members[]`, `createdBy`

7. **`dataroom_external_users`** ⭐ NEW
   - Purpose: External user accounts (non-Upcheck staff)
   - Indexes: `{ email: 1 }` (unique), `{ sessionToken: 1 }`
   - Sample fields: `email`, `passwordHash`, `name`, `sessionToken`, `sessionExpiry`, `status`

8. **`dataroom_access_requests`**
   - Purpose: Access request workflow
   - Indexes: `{ status: 1 }`, `{ requestedBy: 1 }`
   - Sample fields: `resourceType`, `resourceId`, `requestedBy`, `reason`, `status`, `reviewedBy`

9. **`dataroom_ip_whitelist`**
   - Purpose: IP-based access control
   - Indexes: `{ roomId: 1 }`
   - Sample fields: `roomId`, `ipAddress`, `description`, `createdBy`

### **Collaboration Collections**

10. **`dataroom_comments`**
    - Purpose: Document discussions
    - Indexes: `{ documentId: 1 }`, `{ parentId: 1 }`
    - Sample fields: `documentId`, `text`, `mentions[]`, `parentId`, `createdBy`

11. **`dataroom_qa`**
    - Purpose: Q&A system
    - Indexes: `{ roomId: 1 }`, `{ status: 1 }`
    - Sample fields: `roomId`, `question`, `answer`, `category`, `status`, `askedBy`

12. **`dataroom_tasks`**
    - Purpose: Task management
    - Indexes: `{ documentId: 1 }`, `{ assignedTo: 1 }`, `{ status: 1 }`
    - Sample fields: `title`, `description`, `documentId`, `assignedTo`, `dueDate`, `status`

13. **`dataroom_workflows`**
    - Purpose: Approval workflows
    - Indexes: `{ documentId: 1 }`, `{ status: 1 }`
    - Sample fields: `name`, `type`, `steps[]`, `currentStep`, `status`, `documentId`

14. **`dataroom_parties`**
    - Purpose: VDR parties (buyers, sellers, advisors)
    - Indexes: `{ roomId: 1 }`, `{ type: 1 }`
    - Sample fields: `roomId`, `name`, `type`, `contacts[]`, `permissions`

15. **`dataroom_signatures`**
    - Purpose: NDA and document signatures
    - Indexes: `{ documentId: 1 }`, `{ signedBy: 1 }`
    - Sample fields: `documentId`, `signedBy`, `ipAddress`, `timestamp`, `signatureData`

### **Audit & Analytics Collections**

16. **`dataroom_audit_log`**
    - Purpose: Complete audit trail
    - Indexes: `{ timestamp: -1 }`, `{ action: 1 }`, `{ user.id: 1 }`, `{ resourceId: 1 }`
    - Sample fields: `action`, `user`, `resourceType`, `resourceId`, `timestamp`, `ipAddress`, `details`
    - **Note:** Should be immutable (no updates/deletes)

17. **`dataroom_analytics`**
    - Purpose: Pre-computed analytics
    - Indexes: `{ type: 1 }`, `{ date: -1 }`
    - Sample fields: `type`, `data`, `date`, `roomId`

18. **`dataroom_activity_heartbeat`** ⭐ NEW
    - Purpose: Live activity tracking
    - Indexes: `{ expiresAt: 1 }` (TTL index, expires after 10 minutes)
    - Sample fields: `userId`, `documentId`, `action`, `timestamp`, `expiresAt`

### **Configuration Collections**

19. **`dataroom_metadata_templates`**
    - Purpose: Custom metadata schemas
    - Indexes: `{ name: 1 }`
    - Sample fields: `name`, `fields[]`, `applicableTypes[]`, `required`

20. **`dataroom_watermarks`**
    - Purpose: Watermark configurations
    - Indexes: `{ roomId: 1 }`
    - Sample fields: `roomId`, `text`, `position`, `opacity`, `color`

---

## 🔍 Verification Script

Run this in MongoDB shell or Compass to verify all collections exist:

```javascript
// Connect to resources database
use resources;

// List of expected collections
const expectedCollections = [
  'dataroom_rooms',
  'dataroom_folders',
  'dataroom_documents',
  'dataroom_versions',
  'dataroom_permissions',
  'dataroom_user_groups',
  'dataroom_external_users',
  'dataroom_access_requests',
  'dataroom_ip_whitelist',
  'dataroom_comments',
  'dataroom_qa',
  'dataroom_tasks',
  'dataroom_workflows',
  'dataroom_parties',
  'dataroom_signatures',
  'dataroom_audit_log',
  'dataroom_analytics',
  'dataroom_activity_heartbeat',
  'dataroom_metadata_templates',
  'dataroom_watermarks'
];

// Get actual collections
const actualCollections = db.getCollectionNames().filter(name => name.startsWith('dataroom_'));

// Check for missing collections
const missing = expectedCollections.filter(c => !actualCollections.includes(c));
const extra = actualCollections.filter(c => !expectedCollections.includes(c));

print('\n=== Data Room Collection Verification ===\n');
print(`Expected: ${expectedCollections.length} collections`);
print(`Found: ${actualCollections.length} collections`);

if (missing.length > 0) {
  print(`\n❌ Missing (${missing.length}):`);
  missing.forEach(c => print(`  - ${c}`));
} else {
  print('\n✅ All expected collections exist');
}

if (extra.length > 0) {
  print(`\n⚠️  Extra collections (${extra.length}):`);
  extra.forEach(c => print(`  - ${c}`));
}

// Check for GridFS buckets (for file storage)
print('\n=== GridFS Buckets ===');
const buckets = db.getCollectionNames().filter(name => 
  name === 'dataroom_files.files' || name === 'dataroom_files.chunks'
);
if (buckets.length === 2) {
  print('✅ GridFS bucket "dataroom_files" exists');
} else {
  print('❌ GridFS bucket missing or incomplete');
  print('   Expected: dataroom_files.files and dataroom_files.chunks');
}

print('\n=== Index Verification ===');

// Critical indexes to verify
const criticalIndexes = [
  { collection: 'dataroom_external_users', field: 'email', unique: true },
  { collection: 'dataroom_external_users', field: 'sessionToken' },
  { collection: 'dataroom_activity_heartbeat', field: 'expiresAt', ttl: true },
  { collection: 'dataroom_audit_log', field: 'timestamp' },
  { collection: 'dataroom_documents', field: 'fileId' },
  { collection: 'dataroom_documents', field: 'roomId' },
];

criticalIndexes.forEach(({ collection, field, unique, ttl }) => {
  if (db.getCollectionNames().includes(collection)) {
    const indexes = db[collection].getIndexes();
    const hasIndex = indexes.some(idx => {
      const keys = Object.keys(idx.key);
      return keys.includes(field);
    });
    
    if (hasIndex) {
      const details = unique ? ' (unique)' : ttl ? ' (TTL)' : '';
      print(`✅ ${collection}.${field}${details}`);
    } else {
      print(`❌ MISSING: ${collection}.${field}`);
    }
  }
});

print('\n=== Sample Data Check ===');

expectedCollections.forEach(coll => {
  if (db.getCollectionNames().includes(coll)) {
    const count = db[coll].countDocuments();
    print(`${coll}: ${count} documents`);
  }
});

print('\n=== Verification Complete ===\n');
```

---

## 🛠️ Manual Index Creation (if missing)

Run these commands if indexes are missing:

```javascript
use resources;

// External users indexes
db.dataroom_external_users.createIndex({ email: 1 }, { unique: true });
db.dataroom_external_users.createIndex({ sessionToken: 1 });

// Activity heartbeat TTL index (auto-delete after 10 minutes)
db.dataroom_activity_heartbeat.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Audit log indexes
db.dataroom_audit_log.createIndex({ timestamp: -1 });
db.dataroom_audit_log.createIndex({ action: 1 });
db.dataroom_audit_log.createIndex({ 'user.id': 1 });

// Document indexes
db.dataroom_documents.createIndex({ roomId: 1 });
db.dataroom_documents.createIndex({ folderId: 1 });
db.dataroom_documents.createIndex({ fileId: 1 });
db.dataroom_documents.createIndex({ isDeleted: 1 });

// Folder indexes
db.dataroom_folders.createIndex({ roomId: 1 });
db.dataroom_folders.createIndex({ parentId: 1 });

// Permission indexes
db.dataroom_permissions.createIndex({ resourceType: 1, resourceId: 1 });
db.dataroom_permissions.createIndex({ userId: 1 });

// Version indexes
db.dataroom_versions.createIndex({ documentId: 1 });

print('✅ Indexes created successfully');
```

---

## 📊 Collection Size Estimates

Approximate storage requirements:

| Collection | Docs/Room | Size/Doc | Total (100 rooms) |
|------------|-----------|----------|-------------------|
| dataroom_documents | 500 | 2 KB | 100 MB |
| dataroom_audit_log | 10,000 | 1 KB | 1 GB |
| dataroom_versions | 2,000 | 1 KB | 200 MB |
| dataroom_files.chunks | 2,000 | 256 KB | 500 GB (actual files) |
| **Total** | - | - | **~500 GB** |

**Note:** Actual file storage (GridFS) dominates. Metadata is minimal.

---

## ✅ Quick Health Check

Run this to verify system is operational:

```javascript
use resources;

const health = {
  collections: db.getCollectionNames().filter(n => n.startsWith('dataroom_')).length,
  gridfs: db.getCollectionNames().includes('dataroom_files.files'),
  externalUsers: db.dataroom_external_users.countDocuments(),
  auditLogs: db.dataroom_audit_log.countDocuments(),
  rooms: db.dataroom_rooms.countDocuments(),
  documents: db.dataroom_documents.countDocuments(),
};

print(JSON.stringify(health, null, 2));

// Expected output:
// {
//   "collections": 20,
//   "gridfs": true,
//   "externalUsers": <number>,
//   "auditLogs": <number>,
//   "rooms": <number>,
//   "documents": <number>
// }
```

---

## 🚀 Production Readiness

**Before going live:**

1. ✅ Create all indexes (run manual script above)
2. ✅ Verify TTL index on `activity_heartbeat` (check with `db.dataroom_activity_heartbeat.getIndexes()`)
3. ✅ Test external user registration/login flow
4. ✅ Verify audit log is capturing events
5. ✅ Check GridFS file storage works
6. ✅ Test document upload/download
7. ✅ Verify live activity tracking

**Monitoring:**

- Set up alerts for collection sizes
- Monitor TTL index performance
- Track audit log growth rate
- Watch for orphaned GridFS files

---

**Status:** All collections defined. Indexes need manual verification/creation on first deployment.
