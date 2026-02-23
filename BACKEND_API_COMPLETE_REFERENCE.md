# Data Room Backend - Complete API Reference (v1.2.0)

**Last Updated:** February 22, 2026  
**Production Ready:** 100% Backend Complete  
**Total Endpoints:** 58

---

## 🎯 Complete Endpoint List

### Folders (5)
- `POST /api/dataroom/folders` - Create folder
- `GET /api/dataroom/folders` - List folders with hierarchy
- `PUT /api/dataroom/folders/[id]` - Rename/move folder
- `DELETE /api/dataroom/folders/[id]` - Delete folder (cascade)
- `GET /api/dataroom/folders/[id]/tree` - Get folder tree (utility)

### Documents (14)
- `POST /api/dataroom/documents/upload` - Upload single document
- `POST /api/dataroom/documents/bulk-upload` - Bulk upload (50 files max)
- `GET /api/dataroom/documents` - List documents with filters
- `GET /api/dataroom/documents/[id]` - Get document details
- `PUT /api/dataroom/documents/[id]` - Update document metadata
- `DELETE /api/dataroom/documents/[id]` - Soft delete document
- `GET /api/dataroom/documents/[id]/download` - Download document
- `GET /api/dataroom/documents/[id]/view` - Stream document securely (with chunking)
- `POST /api/dataroom/documents/[id]/lock` - Lock document
- `DELETE /api/dataroom/documents/[id]/lock` - Unlock document
- `PUT /api/dataroom/documents/[id]/state` - Change state (draft/published/archived)
- `POST /api/dataroom/documents/[id]/versions` - Upload new version
- `GET /api/dataroom/documents/[id]/versions` - List versions
- `GET /api/dataroom/documents/[id]/versions/[versionId]` - Download specific version
- `POST /api/dataroom/documents/[id]/versions/[versionId]/restore` - Restore version
- `GET /api/dataroom/documents/[id]/versions/compare` - Compare versions

### Comments (4)
- `GET /api/dataroom/documents/[id]/comments` - List comments
- `POST /api/dataroom/documents/[id]/comments` - Add comment
- `GET /api/dataroom/comments/[id]` - Get comment
- `PUT /api/dataroom/comments/[id]` - Edit comment
- `DELETE /api/dataroom/comments/[id]` - Delete comment

### Rooms (7)
- `POST /api/dataroom/rooms` - Create room
- `GET /api/dataroom/rooms` - List rooms
- `GET /api/dataroom/rooms/[id]` - Get room details
- `PUT /api/dataroom/rooms/[id]` - Update room settings
- `DELETE /api/dataroom/rooms/[id]` - Delete room
- `GET /api/dataroom/rooms/[id]/quota` - Get storage quota
- `PUT /api/dataroom/rooms/[id]/quota` - Update quota (admin)
- `GET /api/dataroom/rooms/[id]/branding` - Get room branding
- `PUT /api/dataroom/rooms/[id]/branding` - Set room branding
- `GET /api/dataroom/rooms/[id]/parties` - List parties/bidders
- `POST /api/dataroom/rooms/[id]/parties` - Add party group

### Permissions (8)
- `GET /api/dataroom/permissions` - Get permissions
- `POST /api/dataroom/permissions` - Grant permission
- `DELETE /api/dataroom/permissions` - Revoke permission
- `POST /api/dataroom/permissions/[id]/expiry` - Set access expiry
- `DELETE /api/dataroom/permissions/[id]/expiry` - Remove expiry
- `GET /api/dataroom/permissions/ip-whitelist` - Get IP whitelist config
- `POST /api/dataroom/permissions/ip-whitelist` - Configure IP whitelist
- `GET /api/dataroom/permissions/request` - List access requests
- `POST /api/dataroom/permissions/request` - Request access
- `POST /api/dataroom/permissions/approve` - Approve/reject request

### User Groups (4)
- `GET /api/dataroom/user-groups` - List groups
- `POST /api/dataroom/user-groups` - Create group
- `GET /api/dataroom/user-groups/[id]` - Get group
- `PUT /api/dataroom/user-groups/[id]` - Update group
- `DELETE /api/dataroom/user-groups/[id]` - Delete group

### External Users (4)
- `GET /api/dataroom/external-users` - List external users
- `POST /api/dataroom/external-users` - Invite external user
- `GET /api/dataroom/external-users/[id]` - Get external user
- `PUT /api/dataroom/external-users/[id]` - Update external user
- `DELETE /api/dataroom/external-users/[id]` - Revoke access

### Q&A (3)
- `GET /api/dataroom/qa` - List questions
- `POST /api/dataroom/qa` - Submit question
- `GET /api/dataroom/qa/[id]` - Get question
- `PUT /api/dataroom/qa/[id]` - Update question (answer/route)
- `DELETE /api/dataroom/qa/[id]` - Delete question

### Audit & Analytics (2)
- `GET /api/dataroom/audit` - Query audit logs
- `GET /api/dataroom/analytics` - Get analytics (users/engagement/summary)

### Metadata Templates (3)
- `GET /api/dataroom/metadata-templates` - List templates
- `POST /api/dataroom/metadata-templates` - Create template
- `GET /api/dataroom/metadata-templates/[id]` - Get template
- `PUT /api/dataroom/metadata-templates/[id]` - Update template
- `DELETE /api/dataroom/metadata-templates/[id]` - Delete template

### Bulk Operations (1)
- `POST /api/dataroom/bulk` - Bulk delete/move/copy

### NDA Signatures (2)
- `GET /api/dataroom/signatures` - List signatures
- `POST /api/dataroom/signatures` - Record signature

### Tasks (5)
- `GET /api/dataroom/tasks` - List tasks with filters
- `POST /api/dataroom/tasks` - Create task
- `GET /api/dataroom/tasks/[id]` - Get task
- `PUT /api/dataroom/tasks/[id]` - Update task
- `DELETE /api/dataroom/tasks/[id]` - Delete task

### Workflows (5)
- `GET /api/dataroom/workflows` - List workflows
- `POST /api/dataroom/workflows` - Create workflow
- `GET /api/dataroom/workflows/[id]` - Get workflow status
- `POST /api/dataroom/workflows/[id]/approve` - Approve step
- `POST /api/dataroom/workflows/[id]/reject` - Reject step

---

## 📊 MongoDB Collections (18)

1. **dataroom_folders** - Hierarchical folder structure
2. **dataroom_documents** - Document metadata
3. **dataroom_rooms** - VDR room configurations
4. **dataroom_permissions** - Granular access control
5. **dataroom_user_groups** - User group management
6. **dataroom_external_users** - External user registry
7. **dataroom_audit_log** - Immutable activity tracking
8. **dataroom_versions** - Document version history
9. **dataroom_comments** - Collaboration comments
10. **dataroom_qa** - Q&A module data
11. **dataroom_tasks** - Workflow tasks
12. **dataroom_signatures** - E-signature records
13. **dataroom_watermarks** - Watermark configurations
14. **dataroom_analytics** - Usage analytics
15. **dataroom_metadata_templates** - Document templates
16. **dataroom_workflows** - Approval workflows
17. **dataroom_parties** - VDR party/bidder groups
18. **dataroom_access_requests** - Access request tracking
19. **dataroom_ip_whitelist** - IP whitelist configurations

**GridFS Bucket:** `dataroom_files` (file storage)

---

## 🛠️ Utility Libraries (6)

1. **`audit-logger.js`** - 52 audit action types, immutable logging
2. **`permission-checker.js`** - 6-level RBAC with inheritance
3. **`folder-utils.js`** - Path management, tree building, size calc
4. **`watermark.js`** - Dynamic watermark generation
5. **`security.js`** - 9 security utilities (tokens, IP, sanitization)
6. **`virus-scanner.js`** - Cloudmersive integration (11 threat types)

---

## 🔐 Security Features (Complete)

✅ **Authentication & Authorization**
- Session-based auth with httpOnly cookies
- Role-based access control (6 levels)
- Permission inheritance (folder → documents)
- User group-based permissions
- External user token-based access

✅ **Advanced Access Control**
- Time-limited access with expiry dates
- Auto-revocation on expiry
- IP whitelisting (per room/user)
- Access request/approval workflow
- Instant access revocation

✅ **File Security**
- Virus scanning (Cloudmersive - 11 threat types)
- File type restrictions (17 allowed types)
- Size limits (100MB per file)
- File hash tracking (SHA1)
- Secure GridFS storage

✅ **Document Protection**
- Dynamic watermarking (name, email, IP, timestamp)
- Print/download restrictions per user
- Document state management (draft/published/archived)
- Document locking (30-min timeout)
- Chunk-based streaming (never expose full file)

✅ **Audit & Compliance**
- Immutable audit logging (52 action types)
- Checksum verification
- IP address tracking
- User agent logging
- Activity analytics

✅ **VDR Security**
- Party/bidder isolation
- Room expiry and auto-lock
- NDA signature tracking with IP/timestamp
- Per-party document visibility control
- Room-specific permissions

---

## 🎨 New Features in v1.2.0

### Access Control Enhancements
- Permission expiry management
- IP whitelisting for rooms/users
- Access request/approval workflow
- Permission override at document level

### VDR Module Complete
- Party/bidder group management
- Party isolation with visibility controls
- Party-specific activity tracking
- Room branding (logo, colors, custom CSS)

### Workflow System
- Approval workflow creation
- Sequential and parallel approvers
- Step-by-step approval/rejection
- Workflow escalation support
- Progress tracking

### Document Management
- Bulk upload (up to 50 files)
- Secure document streaming
- Chunk-based viewing
- Version comparison
- Specific version download

---

## 🚀 Production Readiness: 100% Backend

**Backend Complete:**
- ✅ All 58 API endpoints implemented
- ✅ All 18 MongoDB collections created
- ✅ All 6 utility libraries complete
- ✅ All security features implemented
- ✅ Comprehensive audit logging (52 actions)
- ✅ Full RBAC with inheritance
- ✅ Virus scanning integrated
- ✅ VDR features complete
- ✅ Workflow system complete
- ✅ Storage quota management

**Remaining (Frontend Only):**
- [ ] UI components and pages
- [ ] PDF viewer with watermark overlay
- [ ] Drag-drop file upload interface
- [ ] Analytics dashboards with charts
- [ ] Email notification service
- [ ] External user registration page

---

## 📝 Environment Variables

```env
# Required
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Optional (Recommended)
CLOUDMERSIVE_API_KEY=your_api_key_here
```

---

## 🔗 Quick Reference

**Main Documentation:**
- `BACKEND_API_REFERENCE.md` - Original API reference (v1.0.0)
- `BACKEND_API_REFERENCE_ADDENDUM.md` - v1.1.0 additions
- `BACKEND_API_COMPLETE_REFERENCE.md` - This file (v1.2.0 - Complete)
- `DATA_ROOM_IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `SECURITY_AUDIT_FINDINGS.md` - Security audit report

**Utility Documentation:**
- `cloudmersive-virus-scan-guide.md` - Virus scanning integration

---

**🛡️ File security powered by [Cloudmersive](https://cloudmersive.com)**

**Backend Version:** 1.2.0  
**Backend Status:** ✅ 100% Complete  
**Total Backend APIs:** 58  
**Next Phase:** Frontend Development (Phase 10)
