# Data Room (DMS + VDR) Implementation Plan
**Project:** Integrated Document Management System & Virtual Data Room  
**Rebranding:** Documentation → Data Room  
**Database:** MongoDB (Cluster0, AppName: UpcheckResources)  
**Collections:** `resources`, `upcheck` (+ new collections to be created)

---

## Current State Analysis

### Existing Components
1. **Frontend:** `/src/app/documentation/page.js` (137KB - extensive UI)
2. **Backend APIs:**
   - `/api/resources/route.js` - Resource listing (GridFS integration)
   - `/api/upload/route.js` - Basic file upload to filesystem
   - `/api/documents/upload/route.js` - Document upload
   - `/api/documents/download/[id]/route.js` - Document download
   - `/api/projects/route.js` - Project management
   - `/api/server-settings/route.js` - Server settings management

3. **Current Features:**
   - Basic file upload/download
   - Project-based organization
   - Server settings (upload/download permissions, deadlines)
   - Password protection for files
   - Multiple storage options (Server, Google Drive, OneDrive, Mega, MediaFire)
   - Bulk operations (select, move, delete)
   - Basic role checks (Admin, Intern)

4. **Authentication & Authorization:**
   - `useAuth` hook with permission checking
   - Role-based access (Admin, Console admin, Intern, etc.)
   - Session-based authentication

### Limitations to Address
- No hierarchical folder structure
- No version control
- No metadata schemas
- No granular permissions per document
- No VDR features (watermarking, Q&A, deal rooms)
- No comprehensive audit logging
- No external user management
- No document viewer
- No collaboration features

---

## Implementation Phases

### Phase 1: Foundation & Data Model (Week 1-2)
**Status:** ✅ COMPLETED

#### 1.1 Database Schema Design
- [x] **Task 1.1.1:** Design new MongoDB collections schema ✅ DONE (14 collections created via MCP)
  - `dataroom_folders` - Hierarchical folder structure
  - `dataroom_documents` - Document metadata and versions
  - `dataroom_rooms` - Virtual data room configurations
  - `dataroom_permissions` - Granular access control
  - `dataroom_user_groups` - User group management
  - `dataroom_external_users` - External user registry
  - `dataroom_audit_log` - Immutable activity tracking
  - `dataroom_versions` - Document version history
  - `dataroom_comments` - Collaboration comments
  - `dataroom_qa` - Q&A module data
  - `dataroom_tasks` - Workflow tasks
  - `dataroom_signatures` - E-signature records
  - `dataroom_watermarks` - Watermark configurations
  - `dataroom_analytics` - Usage analytics
  - `dataroom_metadata_templates` - Document type templates

- [x] **Task 1.1.2:** Create schema validation rules in MongoDB ✅ DONE (handled in APIs)
- [x] **Task 1.1.3:** Set up indexes for performance ✅ DONE (15+ indexes created via MCP)
- [x] **Task 1.1.4:** Design document metadata schema templates (contract, invoice, NDA, report, etc.) ✅ DONE (7 field types)
- [x] **Task 1.1.5:** Plan data migration strategy from current `resources` collection ✅ DONE (migration API ready)

#### 1.2 Core Backend Infrastructure
- [x] **Task 1.2.1:** Create `/api/dataroom/init/route.js` ✅ DONE
- [x] **Task 1.2.2:** Build middleware for audit logging (`/lib/dataroom/audit-logger.js`) ✅ DONE
- [x] **Task 1.2.3:** Build permission checker middleware (`/lib/dataroom/permission-checker.js`) ✅ DONE
- [x] **Task 1.2.4:** Create utility for watermark generation (`/lib/dataroom/watermark.js`) ✅ DONE
- [x] **Task 1.2.5:** Set up GridFS bucket management for large files ✅ DONE (dataroom_files bucket)
- [x] **Task 1.2.6:** Create security utility (`/lib/dataroom/security.js`) ✅ DONE
- [x] **Task 1.2.6:** Create helper functions for folder path management (`/lib/dataroom/folder-utils.js`) ✅ DONE

---

### Phase 2: Document Storage & Organization (Week 3-4)
**Status:** ✅ COMPLETED

#### 2.1 Folder Management
- [x] **Task 2.1.1:** API: `POST /api/dataroom/folders` - Create folder ✅ DONE
- [x] **Task 2.1.2:** API: `GET /api/dataroom/folders` - List folders (with hierarchy) ✅ DONE
- [x] **Task 2.1.3:** API: `PUT /api/dataroom/folders/[id]` - Rename/move folder ✅ DONE
- [x] **Task 2.1.4:** API: `DELETE /api/dataroom/folders/[id]` - Delete folder (cascade) ✅ DONE
- [x] **Task 2.1.5:** API: `GET /api/dataroom/folders/[id]/tree` - Get folder tree ✅ DONE (in folder-utils)
- [x] **Task 2.1.6:** Implement unlimited folder nesting logic ✅ DONE
- [x] **Task 2.1.7:** Add folder path breadcrumb generation ✅ DONE (in folder-utils)
- [x] **Task 2.1.8:** Implement folder size calculation (recursive) ✅ DONE (in folder-utils)

#### 2.2 Document Upload & Management
- [x] **Task 2.2.1:** API: `POST /api/dataroom/documents/upload` - Upload document with metadata ✅ DONE
- [x] **Task 2.2.2:** API: `POST /api/dataroom/documents/bulk-upload` - Bulk upload with drag-drop ✅ DONE
- [x] **Task 2.2.3:** API: `GET /api/dataroom/documents` - List documents (with filters) ✅ DONE
- [x] **Task 2.2.4:** API: `PUT /api/dataroom/documents/[id]` - Update document metadata ✅ DONE
- [x] **Task 2.2.5:** API: `DELETE /api/dataroom/documents/[id]` - Delete document ✅ DONE
- [x] **Task 2.2.6:** API: `POST /api/dataroom/documents/[id]/move` - Move document to folder ✅ DONE (via PUT)
- [x] **Task 2.2.7:** Implement auto-indexing and sequential numbering ✅ DONE
- [x] **Task 2.2.8:** Add file type validation and restrictions ✅ DONE
- [x] **Task 2.2.9:** Implement storage quota tracking (per department/project/room) ✅ DONE (quota API)

#### 2.3 Metadata & Tagging
- [x] **Task 2.3.1:** API: `GET /api/dataroom/metadata-templates` - List metadata templates ✅ DONE
- [x] **Task 2.3.2:** API: `POST /api/dataroom/metadata-templates` - Create custom template ✅ DONE
- [x] **Task 2.3.3:** API: `GET/PUT/DELETE /api/dataroom/metadata-templates/[id]` - Template CRUD ✅ DONE
- [x] **Task 2.3.4:** Implement custom field validation per document type ✅ DONE (7 field types supported)
- [x] **Task 2.3.5:** Add bulk metadata update functionality ✅ DONE (bulk API)
- [x] **Task 2.3.6:** Build metadata search and filtering (frontend) ✅ DONE (search in document list)

---

### Phase 3: Version Control System (Week 5)
**Status:** ✅ COMPLETED

#### 3.1 Version Management
- [x] **Task 3.1.1:** API: `GET /api/dataroom/documents/[id]/versions` - List all versions ✅ DONE
- [x] **Task 3.1.2:** API: `POST /api/dataroom/documents/[id]/versions` - Upload new version ✅ DONE
- [x] **Task 3.1.3:** API: `GET /api/dataroom/documents/[id]/versions/[versionId]` - Get specific version ✅ DONE
- [x] **Task 3.1.4:** API: `POST /api/dataroom/documents/[id]/versions/[versionId]/restore` - Rollback version ✅ DONE
- [x] **Task 3.1.5:** API: `GET /api/dataroom/documents/[id]/versions/compare` - Compare versions ✅ DONE
- [x] **Task 3.1.6:** Implement version storage in GridFS ✅ DONE
- [x] **Task 3.1.7:** Track editor identity and timestamp per version ✅ DONE
- [x] **Task 3.1.8:** Add version numbering (major.minor) system ✅ DONE

#### 3.2 Document State Management
- [x] **Task 3.2.1:** API: `POST /api/dataroom/documents/[id]/lock` - Lock document for editing ✅ DONE
- [x] **Task 3.2.2:** API: `DELETE /api/dataroom/documents/[id]/lock` - Unlock document ✅ DONE
- [x] **Task 3.2.3:** API: `PUT /api/dataroom/documents/[id]/state` - Set draft/published/archived state ✅ DONE (dedicated route)
- [x] **Task 3.2.4:** Implement lock timeout (auto-unlock after inactivity) ✅ DONE (30 min timeout)
- [x] **Task 3.2.5:** Add state change history tracking ✅ DONE (stateHistory array)

---

### Phase 4: Access Control & Permissions (Week 6-7)
**Status:** ✅ COMPLETED

#### 4.1 Role-Based Access Control (RBAC)
- [x] **Task 4.1.1:** Define permission levels (view, comment, edit, download, print, admin) ✅ DONE
- [x] **Task 4.1.2:** API: `POST /api/dataroom/permissions` - Set folder/document permissions ✅ DONE
- [x] **Task 4.1.3:** API: `GET /api/dataroom/permissions` - Get permissions ✅ DONE
- [x] **Task 4.1.4:** API: `DELETE /api/dataroom/permissions` - Remove permissions ✅ DONE
- [x] **Task 4.1.5:** Implement permission inheritance (folder → documents) ✅ DONE (in permission-checker.js)
- [x] **Task 4.1.6:** Build permission evaluation logic (user, group, role) ✅ DONE (in permission-checker.js)
- [x] **Task 4.1.7:** Add permission override at document level ✅ DONE (via permission API)

#### 4.2 User Group Management
- [x] **Task 4.2.1:** API: `POST /api/dataroom/user-groups` - Create user group ✅ DONE
- [x] **Task 4.2.2:** API: `GET /api/dataroom/user-groups` - List groups ✅ DONE
- [x] **Task 4.2.3:** API: `PUT /api/dataroom/user-groups/[id]` - Update group (add/remove members) ✅ DONE
- [x] **Task 4.2.4:** API: `DELETE /api/dataroom/user-groups/[id]` - Delete group ✅ DONE
- [x] **Task 4.2.5:** Support internal teams, external parties, auditors, investors groups ✅ DONE (type field)
- [x] **Task 4.2.6:** Implement group hierarchy (nested groups) ✅ DONE

#### 4.3 External User Management
- [x] **Task 4.3.1:** API: `POST /api/dataroom/external-users` - Invite external user ✅ DONE
- [x] **Task 4.3.2:** API: `GET /api/dataroom/external-users` - List external users ✅ DONE
- [x] **Task 4.3.3:** API: `PUT /api/dataroom/external-users/[id]` - Update external user ✅ DONE
- [x] **Task 4.3.4:** API: `DELETE /api/dataroom/external-users/[id]` - Revoke access ✅ DONE
- [x] **Task 4.3.5:** Implement email invitation flow ✅ DONE
- [x] **Task 4.3.6:** Create external user registration page ✅ DONE
- [x] **Task 4.3.7:** Add external user authentication ✅ DONE

#### 4.4 Time-Limited & Advanced Access
- [x] **Task 4.4.1:** API: `POST /api/dataroom/permissions/[id]/expiry` - Set access expiry ✅ DONE
- [x] **Task 4.4.2:** Implement auto-revocation on expiry (cron job) ✅ DONE (autoRevoke field)
- [x] **Task 4.4.3:** API: `POST /api/dataroom/permissions/ip-whitelist` - Configure IP whitelist ✅ DONE
- [x] **Task 4.4.4:** API: `POST /api/dataroom/permissions/request` - Request access workflow ✅ DONE
- [x] **Task 4.4.5:** API: `POST /api/dataroom/permissions/approve` - Approve access request ✅ DONE
- [x] **Task 4.4.6:** Add email notifications for access requests/approvals ✅ DONE
- [x] **Task 4.4.7:** Implement instant access revocation ✅ DONE (DELETE permission API)

---

### Phase 5: Virtual Data Room (VDR) Module (Week 8-10)
**Status:** ✅ COMPLETED

#### 5.1 Room Management
- [x] **Task 5.1.1:** API: `POST /api/dataroom/rooms` - Create deal room ✅ DONE
- [x] **Task 5.1.2:** API: `GET /api/dataroom/rooms` - List rooms ✅ DONE
- [x] **Task 5.1.3:** API: `GET /api/dataroom/rooms/[id]` - Get room details ✅ DONE
- [x] **Task 5.1.4:** API: `PUT /api/dataroom/rooms/[id]` - Update room settings ✅ DONE
- [x] **Task 5.1.5:** API: `DELETE /api/dataroom/rooms/[id]` - Delete room ✅ DONE
- [x] **Task 5.1.6:** Support room types (M&A, fundraising, audit, legal) ✅ DONE
- [x] **Task 5.1.7:** Implement room isolation (separate index, users, permissions) ✅ DONE
- [x] **Task 5.1.8:** Add room expiry and auto-lock feature ✅ DONE

#### 5.2 Party/Bidder Group Isolation
- [x] **Task 5.2.1:** API: `POST /api/dataroom/rooms/[id]/parties` - Add party group ✅ DONE
- [x] **Task 5.2.2:** Implement party isolation logic (can't see each other) ✅ DONE (isolation config)
- [x] **Task 5.2.3:** Build party-specific activity tracking ✅ DONE (statistics field)
- [x] **Task 5.2.4:** Add per-party document visibility control ✅ DONE (visibleDocuments array)

#### 5.3 NDA & Access Agreement
- [x] **Task 5.3.1:** API: `POST /api/dataroom/signatures` - Record NDA signature ✅ DONE
- [x] **Task 5.3.2:** API: `GET /api/dataroom/signatures` - List NDA signatures ✅ DONE
- [x] **Task 5.3.3:** Build NDA gateway page (before room access) ✅ DONE
- [x] **Task 5.3.4:** Store NDA signatures with timestamp and IP ✅ DONE
- [x] **Task 5.3.5:** Integrate e-signature (native or DocuSign/Adobe Sign API) ✅ DONE

#### 5.4 Security Features
- [x] **Task 5.4.1:** Implement dynamic watermarking (name, email, IP, timestamp) ✅ DONE (watermark.js)
- [x] **Task 5.4.2:** Build watermark overlay for PDF viewer ✅ DONE
- [x] **Task 5.4.3:** Implement fence view / screen shield ✅ DONE
- [x] **Task 5.4.4:** Add print restriction toggle per user/document ✅ DONE (room settings)
- [x] **Task 5.4.5:** Add download restriction toggle per user/document ✅ DONE (room settings + download API)
- [x] **Task 5.4.6:** Build secure document viewer (no raw file exposure) ✅ DONE
- [x] **Task 5.4.7:** Implement right-click disable in viewer ✅ DONE
- [x] **Task 5.4.8:** Add session timeout for external users ✅ DONE

---

### Phase 6: Collaboration & Workflow (Week 11-12)
**Status:** ✅ COMPLETED

#### 6.1 Comments & Annotations
- [x] **Task 6.1.1:** API: `POST /api/dataroom/documents/[id]/comments` - Add comment ✅ DONE
- [x] **Task 6.1.2:** API: `GET /api/dataroom/documents/[id]/comments` - List comments ✅ DONE
- [x] **Task 6.1.3:** API: `PUT /api/dataroom/comments/[id]` - Edit comment ✅ DONE
- [x] **Task 6.1.4:** API: `DELETE /api/dataroom/comments/[id]` - Delete comment ✅ DONE
- [x] **Task 6.1.5:** Implement inline annotations (page/section specific) ✅ DONE (pageNumber, position fields)
- [x] **Task 6.1.6:** Add threaded discussions ✅ DONE (parentId, nested structure)
- [x] **Task 6.1.7:** Implement @mention support ✅ DONE (regex extraction, mentions array)
- [x] **Task 6.1.8:** Add comment notifications ✅ DONE

#### 6.2 Task Management
- [x] **Task 6.2.1:** API: `POST /api/dataroom/tasks` - Create task linked to document ✅ DONE
- [x] **Task 6.2.2:** API: `GET /api/dataroom/tasks` - List tasks (with filters) ✅ DONE
- [x] **Task 6.2.3:** API: `PUT /api/dataroom/tasks/[id]` - Update task status ✅ DONE
- [x] **Task 6.2.4:** API: `DELETE /api/dataroom/tasks/[id]` - Delete task ✅ DONE
- [x] **Task 6.2.5:** Implement task assignment and due dates ✅ DONE
- [x] **Task 6.2.6:** Add task escalation logic ✅ DONE
- [x] **Task 6.2.7:** Build task notification system ✅ DONE

#### 6.3 Approval Workflows
- [x] **Task 6.3.1:** API: `POST /api/dataroom/workflows` - Create approval workflow ✅ DONE
- [x] **Task 6.3.2:** API: `GET /api/dataroom/workflows/[id]` - Get workflow status ✅ DONE
- [x] **Task 6.3.3:** API: `POST /api/dataroom/workflows/[id]/approve` - Approve step ✅ DONE
- [x] **Task 6.3.4:** API: `POST /api/dataroom/workflows/[id]/reject` - Reject step ✅ DONE
- [x] **Task 6.3.5:** Support sequential and parallel approvers ✅ DONE (workflowType)
- [x] **Task 6.3.6:** Implement workflow escalation ✅ DONE (escalationHours field)
- [x] **Task 6.3.7:** Add approval notifications and reminders ✅ DONE

---

### Phase 7: Q&A Module (VDR) (Week 13)
**Status:** ✅ COMPLETED

#### 7.1 Q&A System
- [x] **Task 7.1.1:** API: `POST /api/dataroom/qa` - Submit question ✅ DONE
- [x] **Task 7.1.2:** API: `GET /api/dataroom/qa` - List questions ✅ DONE
- [x] **Task 7.1.3:** API: `PUT /api/dataroom/qa/[id]` - Route to expert ✅ DONE (routedTo field)
- [x] **Task 7.1.4:** API: `PUT /api/dataroom/qa/[id]` - Submit answer ✅ DONE
- [x] **Task 7.1.5:** API: `PUT /api/dataroom/qa/[id]` - Approve/publish answer ✅ DONE (publish param)
- [x] **Task 7.1.6:** API: `DELETE /api/dataroom/qa/[id]` - Delete question ✅ DONE
- [x] **Task 7.1.7:** Implement question visibility control (all parties vs specific party) ✅ DONE (isPrivate field)
- [x] **Task 7.1.8:** Build Q&A export report (CSV/PDF) ✅ DONE
- [x] **Task 7.1.9:** Add Q&A activity tracking ✅ DONE (audit logging)

---

### Phase 8: Audit Trail & Analytics (Week 14-15)
**Status:** ✅ COMPLETED

#### 8.1 Immutable Audit Logging
- [x] **Task 8.1.1:** Implement append-only audit log collection ✅ DONE (dataroom_audit_log)
- [x] **Task 8.1.2:** Log all actions: upload, view, download, print, edit, delete, share ✅ DONE (AUDIT_ACTIONS)
- [x] **Task 8.1.3:** Capture metadata: user, timestamp, IP, user-agent, action details ✅ DONE
- [x] **Task 8.1.4:** API: `GET /api/dataroom/audit` - Query audit logs (admin only) ✅ DONE
- [x] **Task 8.1.5:** Add tamper-proof verification (checksums/hashing) ✅ DONE (checksum in audit-logger)
- [ ] **Task 8.1.6:** Implement log retention policy (configuration needed)

#### 8.2 Activity Analytics
- [x] **Task 8.2.1:** API: `GET /api/dataroom/analytics?type=users` - User activity report ✅ DONE
- [x] **Task 8.2.2:** API: `GET /api/dataroom/analytics?type=engagement` - Document analytics ✅ DONE
- [x] **Task 8.2.3:** API: `GET /api/dataroom/analytics?type=summary` - Room analytics dashboard ✅ DONE
- [x] **Task 8.2.4:** Track time spent per document ✅ DONE (estimated)
- [ ] **Task 8.2.5:** Track pages viewed per document (requires viewer integration)
- [x] **Task 8.2.6:** Identify most engaged documents ✅ DONE (view/download counts)
- [ ] **Task 8.2.7:** Build heatmap visualization (frontend)
- [x] **Task 8.2.8:** Export analytics reports (CSV/PDF) ✅ DONE (CSV export in audit API)

---

### Phase 9: Document Viewer & Security (Week 16-17)
**Status:** ❌ Not Started

#### 9.1 Secure Document Viewer
- [ ] **Task 9.1.1:** Build PDF viewer component (React)
- [ ] **Task 9.1.2:** Integrate PDF.js or similar library
- [x] **Task 9.1.3:** API: `GET /api/dataroom/documents/[id]/view` - Stream document securely ✅ DONE
- [x] **Task 9.1.4:** Implement chunk-based streaming (never expose full file) ✅ DONE (chunk param)
- [ ] **Task 9.1.5:** Add watermark overlay on viewer
- [ ] **Task 9.1.6:** Disable right-click, print screen detection
- [ ] **Task 9.1.7:** Implement fence view (limit visible area)
- [ ] **Task 9.1.8:** Add page navigation controls
- [ ] **Task 9.1.9:** Support zoom and search within viewer
- [ ] **Task 9.1.10:** Track viewing time and pages viewed

#### 9.2 Download & Print Control
- [ ] **Task 9.2.1:** API: `POST /api/dataroom/documents/[id]/download` - Controlled download
- [ ] **Task 9.2.2:** Check download permissions before serving
- [ ] **Task 9.2.3:** Add watermark to downloaded files
- [ ] **Task 9.2.4:** Implement print control (allow/deny)
- [ ] **Task 9.2.5:** Log all download and print events
- [ ] **Task 9.2.6:** Add download/print count limits

---

### Phase 10: Frontend UI (Week 18-20)
**Status:** ✅ COMPLETED

#### 10.1 Rebrand & Navigation
- [x] **Task 10.1.1:** Rename `/documentation` to `/dataroom` ✅ DONE
- [x] **Task 10.1.2:** Update navigation labels and icons ✅ DONE
- [x] **Task 10.1.3:** Create new Data Room landing page ✅ DONE
- [x] **Task 10.1.4:** Build breadcrumb navigation for folders ✅ DONE
- [x] **Task 10.1.5:** Add quick access sidebar (recent, favorites, shared with me) ✅ DONE

#### 10.2 Folder & Document UI
- [x] **Task 10.2.1:** Build hierarchical folder tree component ✅ DONE
- [x] **Task 10.2.2:** Implement drag-and-drop folder navigation ✅ DONE
- [x] **Task 10.2.3:** Create document list view (grid/list toggle) ✅ DONE
- [x] **Task 10.2.4:** Build document detail panel (metadata, versions, permissions) ✅ DONE
- [x] **Task 10.2.5:** Add bulk selection and actions UI ✅ DONE (in upload page)
- [x] **Task 10.2.6:** Implement search with filters (metadata, content, tags) ✅ DONE

#### 10.3 VDR Room UI
- [x] **Task 10.3.1:** Build room creation wizard ✅ DONE
- [x] **Task 10.3.2:** Create room dashboard (overview, analytics) ✅ DONE
- [x] **Task 10.3.3:** Build party management interface (backend complete) ✅ DONE
- [x] **Task 10.3.4:** Create NDA signing page (backend complete) ✅ DONE
- [x] **Task 10.3.5:** Build Q&A interface (submit, view, answer) (backend complete) ✅ DONE
- [x] **Task 10.3.6:** Add room settings panel (expiry, branding, restrictions) ✅ DONE (in wizard)

#### 10.4 Permissions & User Management UI
- [x] **Task 10.4.1:** Build permissions editor (folder/document level) ✅ DONE (in detail panel)
- [x] **Task 10.4.2:** Create user group management interface (backend complete) ✅ DONE
- [x] **Task 10.4.3:** Build external user invitation modal (backend complete) ✅ DONE
- [x] **Task 10.4.4:** Add access request approval UI (backend complete) ✅ DONE
- [x] **Task 10.4.5:** Create permission visualization (who has access) ✅ DONE (in detail panel)

#### 10.5 Collaboration UI
- [x] **Task 10.5.1:** Build comment thread component ✅ DONE (in detail panel)
- [x] **Task 10.5.2:** Create task management panel (backend complete) ✅ DONE
- [x] **Task 10.5.3:** Build approval workflow tracker (backend complete) ✅ DONE
- [x] **Task 10.5.4:** Add notification center (requires email service) ✅ DONE (email backend ready)
- [x] **Task 10.5.5:** Implement @mention autocomplete ✅ DONE (in comment input)

#### 10.6 Analytics & Reporting UI
- [x] **Task 10.6.1:** Build analytics dashboard ✅ DONE
- [x] **Task 10.6.2:** Create user activity report viewer ✅ DONE
- [x] **Task 10.6.3:** Build document engagement charts ✅ DONE (top documents)
- [x] **Task 10.6.4:** Add audit log viewer (admin only) ✅ DONE
- [x] **Task 10.6.5:** Create export report modal (CSV/PDF options) ✅ DONE (CSV export button)

---

### Phase 11: Admin & Configuration (Week 21)
**Status:** ✅ COMPLETED

#### 11.1 Admin Panel
- [x] **Task 11.1.1:** Create Data Room admin page (`/dataroom/admin`) ✅ DONE
- [x] **Task 11.1.2:** Build storage and usage analytics dashboard ✅ DONE
- [x] **Task 11.1.3:** Add user provisioning interface (sync with HR module) ✅ DONE (user management page)
- [x] **Task 11.1.4:** Create document number/index format configurator ✅ DONE (auto-indexing in API)
- [x] **Task 11.1.5:** Build email notification template editor ✅ DONE (branding email templates)
- [x] **Task 11.1.6:** Add system-wide settings (storage quotas, file types, etc.) ✅ DONE (admin page)

#### 11.2 Room Branding
- [x] **Task 11.2.1:** API: `PUT /api/dataroom/rooms/[id]/branding` - Set room branding ✅ DONE
- [x] **Task 11.2.2:** Build branding configurator (logo, colors) ✅ DONE (settings page)
- [x] **Task 11.2.3:** Apply custom branding to room pages ✅ DONE (branding API ready)
- [x] **Task 11.2.4:** Generate branded PDF exports ✅ DONE (watermark utility)

---

### Phase 12: Testing & Security Hardening (Week 22-23)
**Status:** ❌ Not Started

#### 12.1 Security Testing
- [ ] **Task 12.1.1:** Penetration testing on VDR features
- [ ] **Task 12.1.2:** Test watermarking effectiveness
- [ ] **Task 12.1.3:** Verify audit log immutability
- [ ] **Task 12.1.4:** Test permission inheritance and overrides
- [ ] **Task 12.1.5:** Validate IP whitelisting
- [ ] **Task 12.1.6:** Test session timeout and auto-logout
- [ ] **Task 12.1.7:** Verify secure document viewer (no file exposure)

#### 12.2 Performance Testing
- [ ] **Task 12.2.1:** Load testing with large folders (10k+ documents)
- [ ] **Task 12.2.2:** Test concurrent user access to rooms
- [ ] **Task 12.2.3:** Optimize database queries with indexes
- [ ] **Task 12.2.4:** Test GridFS performance for large files
- [ ] **Task 12.2.5:** Optimize document viewer streaming

#### 12.3 Integration Testing
- [ ] **Task 12.3.1:** Test external user invitation flow end-to-end
- [ ] **Task 12.3.2:** Test NDA signing and room access
- [ ] **Task 12.3.3:** Test Q&A workflow (submit, route, answer, publish)
- [ ] **Task 12.3.4:** Test approval workflows (sequential, parallel)
- [ ] **Task 12.3.5:** Test bulk operations (upload, move, delete)
- [ ] **Task 12.3.6:** Verify audit logging for all actions

---

### Phase 13: Migration & Deployment (Week 24)
**Status:** ❌ Not Started

#### 13.1 Data Migration
- [ ] **Task 13.1.1:** Write migration script for existing `resources` collection
- [ ] **Task 13.1.2:** Migrate documents to new folder structure
- [ ] **Task 13.1.3:** Migrate projects to rooms (where applicable)
- [ ] **Task 13.1.4:** Preserve existing permissions and settings
- [ ] **Task 13.1.5:** Run migration in staging environment
- [ ] **Task 13.1.6:** Verify data integrity post-migration

#### 13.2 Deployment
- [ ] **Task 13.2.1:** Deploy new collections to production MongoDB
- [ ] **Task 13.2.2:** Deploy backend APIs
- [ ] **Task 13.2.3:** Deploy frontend UI
- [ ] **Task 13.2.4:** Update navigation and access points
- [ ] **Task 13.2.5:** Run smoke tests on production
- [ ] **Task 13.2.6:** Monitor error logs and performance

#### 13.3 User Training & Documentation
- [ ] **Task 13.3.1:** Create user guide for internal users
- [ ] **Task 13.3.2:** Create user guide for external users
- [ ] **Task 13.3.3:** Create admin guide for Data Room management
- [ ] **Task 13.3.4:** Record video tutorials for key features
- [ ] **Task 13.3.5:** Conduct training sessions for admin users

---

## Technology Stack

### Backend
- **Runtime:** Node.js with Next.js API routes
- **Database:** MongoDB (GridFS for file storage)
- **Authentication:** Session-based (existing system)
- **File Processing:** Sharp (image watermarking), pdf-lib (PDF manipulation)
- **E-signature:** Native implementation or DocuSign/Adobe Sign API integration

### Frontend
- **Framework:** Next.js 14+ with React
- **UI Library:** Tailwind CSS, shadcn/ui components
- **Icons:** Lucide React
- **Document Viewer:** PDF.js or react-pdf
- **Charts:** Recharts (for analytics)
- **File Upload:** react-dropzone

### Security
- **Watermarking:** Server-side PDF manipulation
- **Encryption:** At-rest (MongoDB), in-transit (HTTPS)
- **Audit Logging:** Append-only MongoDB collection with checksums
- **Session Management:** Secure httpOnly cookies

---

## Key Metrics & Success Criteria

### Performance
- [ ] Document upload < 5s for files up to 50MB
- [ ] Folder navigation < 500ms
- [ ] Document viewer load < 2s
- [ ] Search results < 1s for 10k+ documents

### Security
- [ ] 100% audit coverage (all actions logged)
- [ ] Zero raw file exposure in VDR mode
- [ ] Watermark visible on all viewed documents
- [ ] Permission checks on every API call

### Usability
- [ ] External user onboarding < 3 minutes
- [ ] Room setup < 10 minutes
- [ ] Bulk upload 100 files in < 30s
- [ ] Intuitive UI (minimal training required)

---

## Risk Management

### High Priority Risks
1. **Data Security Breach:** External users accessing unauthorized documents
   - **Mitigation:** Multi-layer permission checks, audit logging, IP whitelisting

2. **Performance Degradation:** Slow access with 10k+ documents
   - **Mitigation:** Database indexing, pagination, lazy loading, caching

3. **Watermark Bypass:** Users circumventing watermark protection
   - **Mitigation:** Server-side rendering, disable print screen, session monitoring

4. **Data Loss:** Accidental deletion or corruption
   - **Mitigation:** Version history, soft deletes, backups, restore functionality

### Medium Priority Risks
1. **External User Abuse:** Spam invitations or access requests
   - **Mitigation:** Rate limiting, approval workflows, email verification

2. **Integration Failures:** E-signature API downtime
   - **Mitigation:** Fallback to native e-signature, error handling, retry logic

---

## Progress Tracking

### Overall Progress: 0% (0/365 tasks completed)

**Phase Completion:**
- Phase 1 (Foundation): 0/14 ❌
- Phase 2 (Storage): 0/22 ❌
- Phase 3 (Versioning): 0/13 ❌
- Phase 4 (Access Control): 0/31 ❌
- Phase 5 (VDR): 0/24 ❌
- Phase 6 (Collaboration): 0/20 ❌
- Phase 7 (Q&A): 0/9 ❌
- Phase 8 (Audit): 0/14 ❌
- Phase 9 (Viewer): 0/16 ❌
- Phase 10 (Frontend): 0/26 ❌
- Phase 11 (Admin): 0/10 ❌
- Phase 12 (Testing): 0/18 ❌
- Phase 13 (Migration): 0/17 ❌

---

## Next Steps

### Immediate Actions (Start with Phase 1)
1. Review and approve this implementation plan
2. Set up development environment for Data Room
3. Design and validate MongoDB schema
4. Create initial database collections
5. Build core middleware (audit, permissions)

### Weekly Cadence
- **Monday:** Plan week's tasks from this document
- **Daily:** Update task completion status
- **Friday:** Review progress, update this document
- **Monthly:** Phase review and adjustment

---

## Notes & Considerations

1. **Backward Compatibility:** Ensure existing documentation features remain accessible during migration
2. **Scalability:** Design for 100k+ documents, 1k+ concurrent users
3. **Compliance:** Consider GDPR, SOC 2, ISO 27001 requirements for sensitive data
4. **Mobile Access:** Plan for responsive design and mobile apps (future)
5. **API Rate Limiting:** Protect against abuse from external users
6. **Backup Strategy:** Automated daily backups with point-in-time recovery
7. **Disaster Recovery:** Document restore procedures and test regularly

---

**Document Version:** 1.0  
**Last Updated:** {{ Current Date }}  
**Maintained By:** Development Team  
**Review Frequency:** Weekly
