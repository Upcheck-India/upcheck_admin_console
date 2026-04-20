# Data Room Frontend Gap Analysis

**Date:** February 22, 2026  
**Status:** 🔍 Identifying Missing Components

---

## ✅ What We Have (18 Pages Created)

### **Core Pages**
1. `/dataroom` - Landing page with stats, rooms, quick access
2. `/dataroom/rooms/[id]` - Room detail with folder tree & documents
3. `/dataroom/rooms/[id]/upload` - Upload documents
4. `/dataroom/rooms/create` - Create new room wizard
5. `/dataroom/rooms/[id]/settings` - Room settings & branding

### **Collaboration Pages**
6. `/dataroom/rooms/[id]/parties` - Party management
7. `/dataroom/rooms/[id]/nda` - NDA signing
8. `/dataroom/qa` - Q&A interface
9. `/dataroom/tasks` - Task management
10. `/dataroom/workflows` - Approval workflows

### **Admin & Management**
11. `/dataroom/admin` - Admin dashboard
12. `/dataroom/analytics` - Analytics & reports
13. `/dataroom/users` - User groups & external users
14. `/dataroom/permissions` - Access request approval

### **Authentication**
15. `/dataroom/auth-gate` - Login selection (Staff vs External)
16. `/dataroom/external/login` - External user login
17. `/dataroom/external/register` - External user registration
18. `/dataroom/request-access` - Request access to resources

---

## ❌ Critical Missing Pages

### **1. Document Viewer** 🚨 CRITICAL
**Route:** `/dataroom/documents/[id]/view`
- **Purpose:** View/read documents in secure viewer
- **Features Needed:**
  - PDF viewer integration (PDF.js)
  - Watermark overlay
  - Print/download controls
  - Version selector
  - Page navigation
  - Zoom controls
- **Backend API:** ✅ EXISTS (`GET /api/dataroom/documents/[id]/view`)

### **2. Audit Log Viewer** 🚨 HIGH PRIORITY
**Route:** `/dataroom/audit`
- **Purpose:** View complete audit trail (admin only)
- **Features Needed:**
  - Filterable log table
  - Search by user, action, date range
  - Export to CSV
  - Pagination
  - Action type filters
- **Backend API:** ✅ EXISTS (`GET /api/dataroom/audit`)

### **3. Live Activity Monitor** 🚨 HIGH PRIORITY
**Route:** `/dataroom/activity`
- **Purpose:** Real-time monitoring of who's viewing what
- **Features Needed:**
  - Active users list
  - Currently viewing documents
  - Auto-refresh every 5 seconds
  - Room filter
  - User type indicator (staff vs external)
- **Backend API:** ✅ EXISTS (`GET /api/dataroom/activity/live`)

### **4. Notifications Center**
**Route:** `/dataroom/notifications`
- **Purpose:** User notifications & alerts
- **Features Needed:**
  - Unread count
  - Mark as read/unread
  - Notification types (mentions, access grants, approvals)
  - Clear all
- **Backend API:** ⚠️ PARTIAL (email backend ready)

### **5. User Profile/Settings**
**Route:** `/dataroom/profile`
- **Purpose:** User preferences and settings
- **Features Needed:**
  - Change password
  - Email preferences
  - Notification settings
  - Session management
- **Backend API:** ⚠️ NEEDS CREATION

### **6. Search Results Page**
**Route:** `/dataroom/search`
- **Purpose:** Global search results
- **Features Needed:**
  - Search across rooms, documents, users
  - Filter by type
  - Preview snippets
  - Recent searches
- **Backend API:** ✅ EXISTS (`GET /api/dataroom/documents/search`)

### **7. Comments/Discussions Page**
**Route:** `/dataroom/rooms/[id]/discussions`
- **Purpose:** View all comments and discussions
- **Features Needed:**
  - Threaded comments view
  - Filter by document
  - Unresolved threads
  - @mention notifications
- **Backend API:** ✅ EXISTS (`GET /api/dataroom/comments`)

---

## 🔗 Missing Navigation Components

### **1. Main Navigation Sidebar** 🚨 CRITICAL
**Component:** `DataRoomNav.js`
- **Location:** Should appear on ALL data room pages
- **Links Needed:**
  - Home / Dashboard
  - My Rooms
  - Analytics
  - Q&A
  - Tasks
  - Workflows
  - Users
  - Permissions
  - Admin
  - Audit Logs
  - Live Activity
  - Notifications (with badge)
  - Profile/Settings

### **2. Room-Specific Tabs**
**Component:** `RoomTabs.js`
- **Location:** Inside room detail pages
- **Tabs Needed:**
  - Documents (current)
  - Parties
  - NDA
  - Settings
  - Activity Log (room-specific)

### **3. Breadcrumb Component**
**Component:** `Breadcrumb.js`
- **Currently:** Partial implementation in room page
- **Needs:** Full path navigation for folders

---

## 🔘 Missing Buttons & Links

### **Main Landing Page** (`/dataroom/page.js`)
- ❌ No link to Analytics from stats
- ❌ No link to Admin panel
- ❌ No link to Audit logs
- ❌ No link to Live Activity
- ❌ "Shared by Me" / "Shared with Me" not clickable

### **Room Detail Page** (`/dataroom/rooms/[id]/page.js`)
- ✅ Upload button - EXISTS
- ✅ NDA button - EXISTS (just added)
- ✅ Settings button - EXISTS (just added)
- ❌ No "View Activity" button
- ❌ No "Audit Log" button
- ❌ No "Manage Parties" button
- ❌ No "Q&A" button
- ❌ No "Tasks" button

### **Document List** (`DocumentList.js` component)
- ❌ No "View" button on documents
- ❌ No "Download" button
- ❌ No "Share" button
- ❌ No "Move/Copy" button

### **Document Detail Panel** (`DocumentDetailPanel.js`)
- ❌ No "Open in Viewer" button
- ❌ No "Download with Watermark" button

### **Admin Page** (`/dataroom/admin/page.js`)
- ❌ No link to Audit Logs
- ❌ No link to Live Activity
- ❌ No link to User Management
- ❌ Stats cards not clickable

---

## 📊 Backend APIs Without Frontend

### **High Priority**
1. `GET /api/dataroom/documents/[id]/view` - **No viewer page**
2. `GET /api/dataroom/audit` - **No audit log page**
3. `GET /api/dataroom/activity/live` - **No live activity page**
4. `POST /api/dataroom/documents/move` - **No move/copy UI**
5. `GET /api/dataroom/documents/[id]/versions/compare` - **No comparison UI**
6. `GET /api/dataroom/analytics/engagement` - **Limited engagement UI**

### **Medium Priority**
7. `GET /api/dataroom/metadata-templates` - **No template management UI**
8. `GET /api/dataroom/rooms/[id]/parties` - **Existing but not linked**
9. `GET /api/dataroom/workflows/[id]` - **Existing but no detail view**
10. `GET /api/dataroom/signatures` - **No signature list UI**

### **Lower Priority**
11. `GET /api/dataroom/quota` - **No quota visualization**
12. `POST /api/dataroom/migrate` - **Admin-only, no UI needed**

---

## 🗄️ Database Collections Status

According to implementation plan, these were created via MCP:
- ✅ `dataroom_folders`
- ✅ `dataroom_documents`
- ✅ `dataroom_rooms`
- ✅ `dataroom_permissions`
- ✅ `dataroom_user_groups`
- ✅ `dataroom_external_users` (just added)
- ✅ `dataroom_audit_log`
- ✅ `dataroom_versions`
- ✅ `dataroom_comments`
- ✅ `dataroom_qa`
- ✅ `dataroom_tasks`
- ✅ `dataroom_signatures`
- ✅ `dataroom_watermarks`
- ✅ `dataroom_analytics`
- ✅ `dataroom_metadata_templates`
- ✅ `dataroom_workflows`
- ✅ `dataroom_parties`
- ✅ `dataroom_access_requests`
- ✅ `dataroom_ip_whitelist`
- ✅ `dataroom_activity_heartbeat` (just added)

**Note:** Collections exist but need to verify indexes are created.

---

## 🎯 Immediate Action Items

### **Priority 1: Critical UX** (Must have for basic usage)
1. ✅ Create main navigation sidebar component
2. ✅ Create document viewer page
3. ✅ Add "View" buttons to document lists
4. ✅ Add room-level navigation tabs
5. ✅ Connect all existing pages with navigation

### **Priority 2: Admin Features** (Must have for management)
6. ✅ Create audit log viewer page
7. ✅ Create live activity monitor page
8. ✅ Add admin navigation links
9. ✅ Create move/copy document UI

### **Priority 3: Enhanced Features** (Nice to have)
10. ⚠️ Create notifications center
11. ⚠️ Create search results page
12. ⚠️ Create user profile/settings page
13. ⚠️ Add version comparison UI

---

## 📝 Summary

**Pages Created:** 18  
**Pages Missing:** 7 (3 critical, 2 high priority, 2 medium)  
**Navigation Components Missing:** 3 (all critical)  
**Buttons/Links Missing:** ~20+ across various pages  
**Backend APIs Without Frontend:** 12 (6 high priority)

**Overall Assessment:** 
- ✅ Backend is 95% complete (58 APIs)
- ⚠️ Frontend is ~60% complete (missing viewer, navigation, connections)
- ❌ Navigation/UX is ~30% complete (pages isolated, no sidebar)

**Recommendation:** 
Focus on:
1. Navigation sidebar (connects everything)
2. Document viewer (core functionality)
3. Audit & activity pages (admin features)
4. Add buttons/links to existing pages

This will bring frontend completion to ~90% and make the system fully usable.
