const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, ExternalHyperlink, Bookmark, InternalHyperlink
} = require('docx');
const fs = require('fs');

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1080; // 0.75 inch
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080 DXA

// Brand colours
const TEAL   = "0A6E6E";
const LTEAL  = "E6F4F4";
const NAVY   = "1A3A4A";
const ACCENT = "F4A228";
const LGRAY  = "F5F6FA";
const MGRAY  = "D0D6E0";
const WHITE  = "FFFFFF";
const BLACK  = "1A1A2E";
const RED    = "C0392B";
const GREEN  = "1A7A4A";

// ─── BORDER HELPERS ──────────────────────────────────────────────────────────
const border = (color = MGRAY, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const allBorders = (c = MGRAY, s = 4) => ({ top: border(c,s), bottom: border(c,s), left: border(c,s), right: border(c,s) });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: WHITE });
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });
const btmBorder = (c = TEAL, s = 8) => ({ top: noBorder(), bottom: border(c,s), left: noBorder(), right: noBorder() });

// ─── STYLE HELPERS ───────────────────────────────────────────────────────────
const run = (text, opts = {}) => new TextRun({ text, font: "Arial", ...opts });
const boldRun = (text, opts = {}) => run(text, { bold: true, ...opts });
const para = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...opts });
const hpara = (text, level, color = BLACK, opts = {}) =>
  new Paragraph({ heading: level, children: [new TextRun({ text, font: "Arial", color, bold: true })], ...opts });

const spacer = (pts = 120) => para([run("")], { spacing: { before: 0, after: pts } });

// coloured section label
const sectionLabel = (text) => para([new TextRun({ text, font: "Arial", bold: true, color: WHITE, size: 22 })], {
  shading: { fill: TEAL, type: ShadingType.CLEAR },
  spacing: { before: 240, after: 60 },
  indent: { left: 80, right: 80 },
});

// inline code style
const code = (text) => new TextRun({ text, font: "Courier New", size: 18, color: "8B0000" });

// ─── TABLE HELPERS ───────────────────────────────────────────────────────────
const cell = (children, opts = {}) => new TableCell({
  borders: opts.borders || allBorders(),
  width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  verticalAlign: opts.va || VerticalAlign.TOP,
  columnSpan: opts.span,
  children: Array.isArray(children) ? children : [para(Array.isArray(children) ? children : [run(children)])],
});

const hdrCell = (text, w) => cell(
  [para([boldRun(text, { color: WHITE, size: 20 })])],
  { width: w, fill: NAVY, borders: allBorders(NAVY) }
);

const dataCell = (text, w, fill = WHITE, bold = false) => cell(
  [para([bold ? boldRun(text, { size: 20 }) : run(text, { size: 20 })])],
  { width: w, fill }
);

const altCell = (text, w, rowIdx, bold = false) => dataCell(text, w, rowIdx % 2 === 0 ? WHITE : LGRAY, bold);

// ─── MERMAID-LIKE DIAGRAMS (via plain ASCII tables) ──────────────────────────
// We'll render diagrams as styled bordered tables with arrows as text

// ─── NUMBERED LIST ───────────────────────────────────────────────────────────
const bullet = (text, level = 0, ref = "bullets") =>
  new Paragraph({ numbering: { reference: ref, level }, children: [run(text, { size: 20 })] });

const numItem = (text, level = 0) => bullet(text, level, "numbers");

// ─── DIVIDER ─────────────────────────────────────────────────────────────────
const divider = (color = TEAL) => para([run("")], {
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
  spacing: { before: 60, after: 60 },
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION BUILDERS
// ════════════════════════════════════════════════════════════════════════════

// ─── COVER PAGE ──────────────────────────────────────────────────────────────
const coverPage = () => [
  para([run("")], { spacing: { before: 1200, after: 0 } }),
  para([boldRun("UPCHECK", { size: 72, color: TEAL })], { alignment: AlignmentType.CENTER }),
  para([boldRun("Shrimp Farm Management Platform", { size: 36, color: NAVY })], { alignment: AlignmentType.CENTER }),
  spacer(60),
  divider(ACCENT),
  spacer(60),
  para([run("Product Architecture & Developer Specification", { size: 28, color: NAVY, italics: true })], { alignment: AlignmentType.CENTER }),
  spacer(120),
  para([run("Stack: Expo React Native SDK 51  ·  Supabase  ·  NestJS", { size: 22, color: "666666" })], { alignment: AlignmentType.CENTER }),
  para([run("Version 1.0  ·  June 2025  ·  Confidential", { size: 20, color: "888888" })], { alignment: AlignmentType.CENTER }),
  spacer(600),
  divider(MGRAY),
  para([run("This document defines the complete architecture, user model, permissions matrix, UX flow, data schema and feature logic for the Upcheck mobile application. It is intended for product managers, backend engineers, and frontend developers.", { size: 20, color: "444444", italics: true })], { alignment: AlignmentType.CENTER }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── TOC ─────────────────────────────────────────────────────────────────────
const tocSection = () => [
  hpara("Table of Contents", HeadingLevel.HEADING_1, NAVY),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 1: PRODUCT OVERVIEW ─────────────────────────────────────────────
const section1 = () => [
  hpara("1. Product Overview", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("1.1 What Upcheck Does", HeadingLevel.HEADING_2, NAVY),
  para([run("Upcheck is a mobile-first farm management platform for shrimp aquaculture operations across India. It replaces notebooks, WhatsApp chains, and loose spreadsheets with a structured, role-aware digital system that works on entry-level Android hardware, with or without internet connectivity.", { size: 20 })]),
  spacer(80),

  hpara("1.2 Core Data Hierarchy", HeadingLevel.HEADING_2, NAVY),
  para([run("Every piece of data in the system belongs to one of three structural layers:", { size: 20 })]),
  spacer(40),

  // Hierarchy diagram as table
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({ children: [cell(
        [
          para([boldRun("FARM", { color: WHITE, size: 24 })], { alignment: AlignmentType.CENTER }),
          para([run("Legal or operational unit owned by one person. Permanent entity.", { color: WHITE, size: 18 })], { alignment: AlignmentType.CENTER }),
        ],
        { width: CONTENT_W, fill: TEAL, borders: allBorders(TEAL) }
      )] }),
      new TableRow({ children: [cell(
        [para([run("↓  contains one or more", { color: MGRAY, size: 18 })], { alignment: AlignmentType.CENTER })],
        { width: CONTENT_W, fill: LGRAY, borders: allBorders(LGRAY) }
      )] }),
      new TableRow({ children: [cell(
        [
          para([boldRun("POND", { color: WHITE, size: 24 })], { alignment: AlignmentType.CENTER }),
          para([run("Physical growing unit. Permanent. Identified by name/number per farm.", { color: WHITE, size: 18 })], { alignment: AlignmentType.CENTER }),
        ],
        { width: CONTENT_W, fill: NAVY, borders: allBorders(NAVY) }
      )] }),
      new TableRow({ children: [cell(
        [para([run("↓  contains one or more", { color: MGRAY, size: 18 })], { alignment: AlignmentType.CENTER })],
        { width: CONTENT_W, fill: LGRAY, borders: allBorders(LGRAY) }
      )] }),
      new TableRow({ children: [cell(
        [
          para([boldRun("CROP CYCLE", { color: BLACK, size: 24 })], { alignment: AlignmentType.CENTER }),
          para([run("Time-bounded production run inside a pond. Active or closed. All operational data attaches here.", { size: 18 })], { alignment: AlignmentType.CENTER }),
        ],
        { width: CONTENT_W, fill: "FEE8C8", borders: allBorders(ACCENT) }
      )] }),
    ],
  }),
  spacer(80),

  hpara("1.3 Tech Stack", HeadingLevel.HEADING_2, NAVY),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 3640, 3640],
    rows: [
      new TableRow({ children: [hdrCell("Layer", 2800), hdrCell("Technology", 3640), hdrCell("Role", 3640)] }),
      new TableRow({ children: [altCell("Mobile App", 2800, 0, true), altCell("Expo React Native SDK 51", 3640, 0), altCell("All farmer-facing UI. Android primary target.", 3640, 0)] }),
      new TableRow({ children: [altCell("Backend API", 2800, 1, true), altCell("NestJS (Node.js)", 3640, 1), altCell("REST + WebSocket endpoints, business logic, auth guards.", 3640, 1)] }),
      new TableRow({ children: [altCell("Database", 2800, 0, true), altCell("Supabase (PostgreSQL)", 3640, 0), altCell("Row-level security, realtime subscriptions, auth tokens.", 3640, 0)] }),
      new TableRow({ children: [altCell("Auth", 2800, 1, true), altCell("Supabase Auth + NestJS JWT guard", 3640, 1), altCell("OTP via SMS for low-literacy users. PIN fallback.", 3640, 1)] }),
      new TableRow({ children: [altCell("Offline Storage", 2800, 0, true), altCell("WatermelonDB (SQLite)", 3640, 0), altCell("Local DB synced to Supabase. Offline-first writes.", 3640, 0)] }),
      new TableRow({ children: [altCell("Notifications", 2800, 1, true), altCell("FCM + Twilio SMS + WhatsApp API", 3640, 1), altCell("Tri-channel: push, SMS, WhatsApp Business.", 3640, 1)] }),
      new TableRow({ children: [altCell("IoT Bridge", 2800, 0, true), altCell("MQTT → AWS IoT Core → NestJS", 3640, 0), altCell("Custom sensor node integration (ESP32 based).", 3640, 0)] }),
      new TableRow({ children: [altCell("File Storage", 2800, 1, true), altCell("Supabase Storage (S3-compatible)", 3640, 1), altCell("Photos, reports, traceability documents.", 3640, 1)] }),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 2: USER MODEL & ROLES ───────────────────────────────────────────
const section2 = () => [
  hpara("2. User Model & Role Architecture", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("2.1 Single Account, Multiple Identities", HeadingLevel.HEADING_2, NAVY),
  para([run("Every person is a single User in the system. A User has a Primary Role (their self-described identity) and zero or more Farm Memberships, each carrying a separate Farm Role. The two are independent.", { size: 20 })]),
  spacer(60),

  // User model diagram
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3360, 720, 3000, 3000],
    rows: [
      new TableRow({ children: [
        hdrCell("User (Account)", 3360),
        hdrCell("", 720),
        hdrCell("Primary Role", 3000),
        hdrCell("Farm Memberships", 3000),
      ]}),
      new TableRow({ children: [
        dataCell("Ravi Shankar\n+91 98400 XXXXX", 3360, LGRAY, true),
        dataCell("→", 720, LGRAY),
        dataCell("Owner (self-described at signup)", 3000, LGRAY),
        dataCell("Farm A: Owner\nFarm B: Owner\nFarm C: Manager", 3000, LGRAY),
      ]}),
      new TableRow({ children: [
        dataCell("Raj Kumar\n+91 99400 XXXXX", 3360, WHITE, true),
        dataCell("→", 720, WHITE),
        dataCell("Manager", 3000, WHITE),
        dataCell("Farm A: Manager", 3000, WHITE),
      ]}),
      new TableRow({ children: [
        dataCell("Kumar Swamy\n+91 97400 XXXXX", 3360, LGRAY, true),
        dataCell("→", 720, LGRAY),
        dataCell("Worker", 3000, LGRAY),
        dataCell("Farm A: Worker\nFarm B: Worker", 3000, LGRAY),
      ]}),
    ],
  }),
  spacer(80),

  hpara("2.2 The Multi-Role Home Screen Problem — Solved", HeadingLevel.HEADING_2, NAVY),
  para([run("When a user holds different roles across multiple farms, the app must pick a home screen. The resolution logic is:", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3200, 720, 6160],
    rows: [
      new TableRow({ children: [hdrCell("Condition", 3200), hdrCell("→", 720), hdrCell("Home Screen Shown", 6160)] }),
      new TableRow({ children: [altCell("User is Owner in any farm", 3200, 0), altCell("→", 720, 0), altCell("Owner Home (portfolio view of all farms)", 6160, 0)] }),
      new TableRow({ children: [altCell("User is Manager in ≥1 farm, no Owner role", 3200, 1), altCell("→", 720, 1), altCell("Manager Home (operations view for first/default farm)", 6160, 1)] }),
      new TableRow({ children: [altCell("User is Worker only", 3200, 0), altCell("→", 720, 0), altCell("Worker Home (task list across all assigned farms)", 6160, 0)] }),
      new TableRow({ children: [altCell("User is Owner of Farm A + Worker of Farm B", 3200, 1), altCell("→", 720, 1), altCell("Owner Home by default. Farm B tasks surfaced in unified task list.", 6160, 1)] }),
    ],
  }),
  spacer(60),
  para([run("The home screen is determined by the highest role held across any farm: Owner > Manager > Worker. The user can switch active farm context from the Farms tab or via a top-bar selector.", { size: 20, italics: true, color: "555555" })]),
  spacer(80),

  hpara("2.3 Farm Roles — Defined", HeadingLevel.HEADING_2, NAVY),
  para([run("There are four farm roles. Roles belong to farm memberships, not accounts.", { size: 20 })]),
  spacer(40),

  // Role cards as table
  ...[
    { role: "OWNER", fill: TEAL, desc: "Full legal and operational control of the farm. Can create and delete the farm, manage all members, access all data, and see financial reporting.", color: WHITE },
    { role: "MANAGER", fill: NAVY, desc: "Full operational access. Can run daily operations, assign tasks, manage workers, access all pond and cycle data. Cannot delete the farm or transfer ownership.", color: WHITE },
    { role: "SUPERVISOR", fill: "2E7D32", desc: "A limited operational role between Manager and Worker. Can view all pond data, approve task completions, record observations. Cannot invite members or change farm settings. Useful for experienced field staff.", color: WHITE },
    { role: "WORKER", fill: ACCENT, desc: "Task-execution only. Sees assigned tasks, records completion with data or photo, can raise alerts. Cannot view farm-level financials, invite anyone, or change cycle settings.", color: BLACK },
  ].map(r => new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1440, 8640],
    rows: [new TableRow({ children: [
      cell([para([boldRun(r.role, { color: r.color, size: 20 })])], { width: 1440, fill: r.fill, borders: allBorders(r.fill), va: VerticalAlign.CENTER }),
      cell([para([run(r.desc, { size: 20 })])], { width: 8640, fill: LGRAY, borders: allBorders(MGRAY) }),
    ]})],
  })).concat(spacer(12)),
  spacer(80),

  hpara("2.4 Viewer / Guest Role", HeadingLevel.HEADING_2, NAVY),
  para([run("Lenders, insurance assessors, veterinary consultants, and feed company representatives need read-only access for a limited period. The Viewer role is time-bounded (max 90 days, renewable) and gives read access to pond performance and cycle summaries only — no task data, no financials, no worker identity.", { size: 20 })]),
  spacer(80),

  hpara("2.5 Full Permissions Matrix", HeadingLevel.HEADING_2, NAVY),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3240, 1440, 1440, 1440, 1440, 2080],
    rows: [
      new TableRow({ children: [
        hdrCell("Permission", 3240),
        hdrCell("Owner", 1440),
        hdrCell("Manager", 1440),
        hdrCell("Supervisor", 1440),
        hdrCell("Worker", 1440),
        hdrCell("Viewer", 2080),
      ]}),
      ...([
        ["Create / delete farm", "✓", "✗", "✗", "✗", "✗"],
        ["Edit farm settings", "✓", "✗", "✗", "✗", "✗"],
        ["Transfer ownership", "✓", "✗", "✗", "✗", "✗"],
        ["Invite Manager/Supervisor", "✓", "✓", "✗", "✗", "✗"],
        ["Invite Worker", "✓", "✓", "✓", "✗", "✗"],
        ["Invite Viewer", "✓", "✓", "✗", "✗", "✗"],
        ["Remove any member", "✓", "✗", "✗", "✗", "✗"],
        ["Create / delete pond", "✓", "✓", "✗", "✗", "✗"],
        ["Start crop cycle", "✓", "✓", "✗", "✗", "✗"],
        ["Close crop cycle", "✓", "✓", "✗", "✗", "✗"],
        ["Edit cycle settings", "✓", "✓", "✗", "✗", "✗"],
        ["Record feed entry", "✓", "✓", "✓", "✓", "✗"],
        ["Record water quality", "✓", "✓", "✓", "✓", "✗"],
        ["Record sampling / ABW", "✓", "✓", "✓", "✓", "✗"],
        ["Record mortality", "✓", "✓", "✓", "✓", "✗"],
        ["Record disease/treatment", "✓", "✓", "✓", "✓", "✗"],
        ["Assign tasks", "✓", "✓", "✓", "✗", "✗"],
        ["Complete task", "✓", "✓", "✓", "✓", "✗"],
        ["Verify/approve task", "✓", "✓", "✓", "✗", "✗"],
        ["View pond data", "✓", "✓", "✓", "✓", "Read"],
        ["View financial data", "✓", "✓", "✗", "✗", "✗"],
        ["View reports", "✓", "✓", "✗", "✗", "Read"],
        ["Use calculators", "✓", "✓", "✓", "✓", "✗"],
        ["Manage inventory", "✓", "✓", "✓", "✗", "✗"],
        ["Place marketplace orders", "✓", "✓", "✗", "✗", "✗"],
        ["View traceability chain", "✓", "✓", "✓", "✓", "Read"],
        ["Manage IoT sensors", "✓", "✓", "✗", "✗", "✗"],
      ].map((row, i) => new TableRow({ children: [
        dataCell(row[0], 3240, i%2===0 ? WHITE : LGRAY, true),
        dataCell(row[1], 1440, row[1]==="✓" ? "E8F5E9" : i%2===0 ? WHITE : LGRAY),
        dataCell(row[2], 1440, row[2]==="✓" ? "E8F5E9" : i%2===0 ? WHITE : LGRAY),
        dataCell(row[3], 1440, row[3]==="✓" ? "E8F5E9" : i%2===0 ? WHITE : LGRAY),
        dataCell(row[4], 1440, row[4]==="✓" ? "E8F5E9" : row[4]==="✗" ? "FFEBEE" : i%2===0 ? WHITE : LGRAY),
        dataCell(row[5], 2080, row[5]==="Read" ? "FFF8E1" : i%2===0 ? WHITE : LGRAY),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("2.6 Member Lifecycle", HeadingLevel.HEADING_2, NAVY),
  para([run("All membership state changes must be logged with timestamp, actor, and reason.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3200, 6880],
    rows: [
      new TableRow({ children: [hdrCell("Event", 3200), hdrCell("Behaviour", 6880)] }),
      ...([
        ["Worker removed from farm", "Immediate access revocation. Historical records they created are retained and attributed to their name. They can no longer log in to that farm context."],
        ["Worker role upgraded to Supervisor", "Role change takes effect on next login. Existing task assignments are preserved."],
        ["Owner transfers farm", "Two-step confirmation required (owner confirms, new owner accepts). Transferor becomes Manager by default."],
        ["Owner account deleted", "Farm is orphaned into suspended state for 30 days. An email + SMS is sent to all Managers to claim ownership before purge."],
        ["Viewer access expires", "Read-only tokens invalidated automatically. Viewer is notified 7 days and 1 day before expiry."],
      ].map((r,i) => new TableRow({ children: [
        dataCell(r[0], 3200, i%2===0?WHITE:LGRAY, true),
        dataCell(r[1], 6880, i%2===0?WHITE:LGRAY),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 3: AUTH FLOWS ────────────────────────────────────────────────────
const section3 = () => [
  hpara("3. Authentication & Onboarding", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("3.1 Auth Method Choice", HeadingLevel.HEADING_2, NAVY),
  para([run("For low-literacy farm workers, password-based auth is a support burden. The default auth path is mobile OTP. PIN (4-digit) is used as the device-local biometric substitute for offline sessions.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2880, 4800],
    rows: [
      new TableRow({ children: [hdrCell("Auth Method", 2400), hdrCell("Who Uses It", 2880), hdrCell("Notes", 4800)] }),
      ...([
        ["Mobile OTP (SMS)", "All users — primary method", "6-digit OTP via Twilio/MSG91. 5-minute expiry. 3-attempt lockout."],
        ["PIN (4-digit)", "All users — offline/quick login", "Set during onboarding. Stored hashed in WatermelonDB. Used when offline or for quick re-auth."],
        ["Password", "Owner/Manager optional", "Available as secondary method for power users who prefer it."],
        ["Biometric (Face/Fingerprint)", "All users — device capability permitting", "Expo LocalAuthentication. Falls back to PIN."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2880, i),
        altCell(r[2], 4800, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("3.2 First Launch — New User Flow", HeadingLevel.HEADING_2, NAVY),
  spacer(40),

  // Flow as step table
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [720, 3240, 6120],
    rows: [
      new TableRow({ children: [hdrCell("#", 720), hdrCell("Screen", 3240), hdrCell("What Happens / Decisions", 6120)] }),
      ...([
        ["1", "Language Select", "User picks language: Telugu, Tamil, English, Odia, Gujarati, Bengali. Stored in device prefs. All subsequent screens render in that language."],
        ["2", "Mobile Number Entry", "Phone number input with country code. Numeric keypad auto-shown. 'Get OTP' button."],
        ["3", "OTP Verification", "6-digit entry. Auto-advance on last digit. Resend after 60s. 3 fails = 15-min lockout."],
        ["4", "Set PIN", "4-digit PIN for offline/quick access. Confirmed twice. Biometric prompt shown if device supports it."],
        ["5", "Name Entry", "First name (required). Last name (optional). Large text input with voice entry option."],
        ["6", "Primary Role Select", "Three large cards: Farm Owner / Farm Manager / Farm Worker. Tap to select. This sets onboarding path only."],
        ["7A (Owner)", "Create Farm", "Farm name, state, district, pincode. Optional: farm area (acres), farm type."],
        ["7B (Manager/Worker)", "Join Farm", "Enter 6-digit Farm Code shared by owner. OR scan QR code on farm invite poster. Redirects to pending approval state if Owner hasn't pre-approved."],
        ["8", "Notification Permission", "Request FCM push. If denied, explain WhatsApp/SMS fallback."],
        ["9", "Home Screen", "First load of role-appropriate home screen. Brief coach marks (dismissible) for first-time users."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 720, i, true),
        altCell(r[1], 3240, i, true),
        altCell(r[2], 6120, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("3.3 Returning User Flow", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  para([run("On app open, check for a valid JWT in secure storage (Expo SecureStore). If valid and device online: skip to home. If valid but offline: skip to home, flag offline mode. If expired: show PIN entry (not full OTP) for quick re-auth. If PIN fails 5 times: full OTP re-auth.", { size: 20 })]),
  spacer(80),

  hpara("3.4 Invitation Flow (Owner invites Worker)", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [720, 3240, 6120],
    rows: [
      new TableRow({ children: [hdrCell("#", 720), hdrCell("Actor", 3240), hdrCell("Action", 6120)] }),
      ...([
        ["1", "Owner", "Goes to Farm Settings → Members → Invite. Selects role. Enters phone number or generates a 6-digit code + QR poster."],
        ["2", "System", "Sends WhatsApp message + SMS to the worker's number with deep link and farm code."],
        ["3", "Worker", "Taps deep link or manually enters code. If no account: OTP sign-up + PIN. If account exists: code validation only."],
        ["4", "System", "Creates farm_membership row with pending status. Notifies Owner."],
        ["5", "Owner", "Approves membership from Pending Members list. (Can be pre-approved for bulk field workers.)"],
        ["6", "Worker", "Gets push/SMS confirmation. Farm appears in their Farms tab on next sync."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 720, i, true),
        altCell(r[1], 3240, i, true),
        altCell(r[2], 6120, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 4: NAVIGATION & SCREENS ─────────────────────────────────────────
const section4 = () => [
  hpara("4. Navigation Architecture & Screen Design", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("4.1 Navigation Shell", HeadingLevel.HEADING_2, NAVY),
  para([run("The bottom tab bar has exactly 5 tabs — no 'More' graveyard. Every feature lives either in a tab or in a contextual action within a tab. Tab icons must be large (28px) and labelled in the selected language.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1440, 1440, 3240, 3960],
    rows: [
      new TableRow({ children: [hdrCell("Tab", 1440), hdrCell("Icon", 1440), hdrCell("Label", 3240), hdrCell("Visible To", 3960)] }),
      ...([
        ["1", "🏠", "Home", "All roles — content differs"],
        ["2", "✅", "Tasks", "All roles — scope differs"],
        ["3", "🌊", "Farms", "All roles — All their farms"],
        ["4", "📦", "Tools", "Owner/Manager/Supervisor — Calculators, Inventory, Ecommerce, Reports"],
        ["5", "👤", "Profile", "All roles — Settings, Notifications, Language, Logout"],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 1440, i, true),
        altCell(r[1], 1440, i),
        altCell(r[2], 3240, i),
        altCell(r[3], 3960, i),
      ]}))),
    ],
  }),
  spacer(40),
  para([run("Workers see tabs 1, 2, 3, 5 only. The Tools tab is hidden for Workers — it is not greyed out, simply not present, to avoid confusion.", { size: 20, italics: true, color: "555555" })]),
  spacer(80),

  hpara("4.2 Owner Home Screen", HeadingLevel.HEADING_2, NAVY),
  para([run("Answers the question: 'How are all my farms doing right now?' Loaded with realtime data or last-sync cache.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 7280],
    rows: [
      new TableRow({ children: [hdrCell("Widget / Section", 2800), hdrCell("Data Source & Behaviour", 7280)] }),
      ...([
        ["Farm Portfolio Cards (scrollable horizontal)", "One card per farm. Shows: Farm name, active cycles count, ponds count, unresolved alert count. Tapping opens Farm Detail."],
        ["Critical Alerts Banner", "Appears only if any farm has severity=HIGH alerts. Red banner. Dismissible per alert. Taps to alert detail."],
        ["Active Cycles Summary", "Count of active cycles across all farms. DOC range (min-max). Total estimated biomass (sum of last samplings)."],
        ["Today's Tasks (cross-farm)", "Count of pending tasks across all farms for today. Tap to go to Tasks tab with filter pre-applied."],
        ["Quick Actions (FAB)", "Floating Action Button: + Add Pond, + Start Cycle, + Assign Task."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 7280, i),
      ]}))),
    ],
  }),
  para([run("NOTE: Revenue Forecast is deferred to v2. It requires biomass + price data pipelines that are not available in v1. Showing a placeholder damages trust.", { size: 20, color: RED, bold: true })]),
  spacer(80),

  hpara("4.3 Manager Home Screen", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 7280],
    rows: [
      new TableRow({ children: [hdrCell("Widget / Section", 2800), hdrCell("Data Source & Behaviour", 7280)] }),
      ...([
        ["Active Farm Selector", "If Manager in multiple farms: top dropdown. Default = last active farm."],
        ["Today's Operations Checklist", "Auto-generated from recurring task templates for active cycles: feeding rounds, water checks, sampling schedule. % complete shown."],
        ["Worker Status Panel", "Number of workers: active today / total assigned. Tapping expands per-worker task completion."],
        ["Pending Approvals", "Tasks marked complete by workers, awaiting verification. Sorted by time."],
        ["Pond Quick Status", "Horizontal pond scroll: each pond chip shows its DOC and last dissolved oxygen reading. Red if out of range."],
        ["Alerts Panel", "All unresolved alerts for current farm. Tap to dismiss or escalate."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 7280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("4.4 Worker Home Screen", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 7280],
    rows: [
      new TableRow({ children: [hdrCell("Widget / Section", 2800), hdrCell("Data Source & Behaviour", 7280)] }),
      ...([
        ["My Tasks — Today", "Sorted by time window (morning / afternoon / evening). Large tap targets. Each task shows pond name, farm name, time slot."],
        ["Overdue Tasks", "Red section above today's list. Requires action or must be marked skipped with reason."],
        ["Quick Record Buttons", "Large icon buttons: 📍 Feed Entry, 💧 Water Check, 📊 Sampling, ⚠️ Report Issue. One-tap access to most common data entry forms."],
        ["Farm Badge", "If worker belongs to multiple farms: small coloured badge on each task card showing which farm it belongs to."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 7280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("4.5 Screen Navigation Map", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  // Navigation map as tree table
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1440, 2880, 2880, 2880],
    rows: [
      new TableRow({ children: [hdrCell("Tab", 1440), hdrCell("Level 1", 2880), hdrCell("Level 2", 2880), hdrCell("Level 3", 2880)] }),
      ...([
        ["Home", "Owner / Manager / Worker Home", "Farm Detail", "Pond Detail → Cycle Detail"],
        ["Tasks", "My Tasks (filtered list)", "Task Detail", "Complete Task Form"],
        ["Farms", "All Farms List", "Farm Dashboard", "Members / Settings / Ponds"],
        ["Tools", "Tools Menu", "Calculator / Inventory / Reports / Ecommerce", "Item Detail / Report View"],
        ["Profile", "Profile Screen", "Notification Prefs / Language / Security", "—"],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 1440, i, true),
        altCell(r[1], 2880, i),
        altCell(r[2], 2880, i),
        altCell(r[3], 2880, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 5: CORE FEATURES — FARM / POND / CYCLE ──────────────────────────
const section5 = () => [
  hpara("5. Core Data Features", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("5.1 Farm Management", HeadingLevel.HEADING_2, NAVY),
  para([run("A Farm is the top-level entity. It has members (with roles), ponds, and settings.", { size: 20 })]),
  spacer(40),

  sectionLabel("Farm Data Model (Supabase Table: farms)"),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Column", 2400), hdrCell("Type", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["id", "uuid (PK)", "Auto-generated."],
        ["name", "text", "Farm name. Required."],
        ["owner_id", "uuid (FK → users)", "Cannot be null. RLS: only owner can update."],
        ["state", "text", "Indian state (dropdown from list)."],
        ["district", "text", "District name."],
        ["pincode", "char(6)", "Validated 6-digit format."],
        ["area_acres", "numeric", "Optional. Farm area."],
        ["farm_code", "char(6)", "Unique invite code. Regeneratable by owner."],
        ["is_active", "boolean", "Soft delete flag."],
        ["settings", "jsonb", "Notification prefs, language override, alert thresholds."],
        ["created_at", "timestamptz", "UTC."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("5.2 Pond Management", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  sectionLabel("Pond Data Model (Supabase Table: ponds)"),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Column", 2400), hdrCell("Type", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["id", "uuid (PK)", ""],
        ["farm_id", "uuid (FK → farms)", ""],
        ["name", "text", "e.g. 'Pond 3' or 'North Pond'. Unique within farm."],
        ["area_acres", "numeric", "Pond surface area."],
        ["depth_feet", "numeric", "Average depth."],
        ["pond_type", "text", "Semi-intensive / Intensive / HDPE-lined."],
        ["water_source", "text", "Canal / Borewell / Creek."],
        ["aerator_count", "integer", "Number of aerators installed."],
        ["sensor_node_ids", "text[]", "Array of IoT sensor node IDs paired to this pond."],
        ["is_active", "boolean", "False = pond is decommissioned."],
        ["created_at", "timestamptz", ""],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("5.3 Crop Cycle Management", HeadingLevel.HEADING_2, NAVY),
  para([run("A Crop Cycle is the time-bounded production run inside a pond. Only one cycle can be active per pond at a time. All operational records (feed, water, sampling, mortality, treatment) belong to a cycle.", { size: 20 })]),
  spacer(40),
  sectionLabel("Crop Cycle Data Model (Supabase Table: crop_cycles)"),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Column", 2400), hdrCell("Type", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["id", "uuid (PK)", ""],
        ["pond_id", "uuid (FK → ponds)", ""],
        ["farm_id", "uuid (FK → farms)", "Denormalised for query efficiency."],
        ["status", "text", "active | closed | abandoned"],
        ["stocking_date", "date", "Required to start a cycle. DOC computed from this."],
        ["pl_count", "integer", "Post-larvae count stocked. Used for survival rate."],
        ["pl_size", "text", "PL12 / PL15 / PL20 etc."],
        ["seed_supplier", "text", "Hatchery name."],
        ["species", "text", "L. vannamei / P. monodon / other."],
        ["target_doc", "integer", "Expected harvest DOC. Drives sampling schedule."],
        ["feed_brand", "text", "Primary feed brand for this cycle."],
        ["doc_at_close", "integer", "Computed on cycle close."],
        ["harvest_date", "date", "Set on close."],
        ["total_harvest_kg", "numeric", "Total harvest weight in kg."],
        ["total_feed_kg", "numeric", "Running total. Updated on each feed entry."],
        ["fcr", "numeric", "Computed: total_feed_kg / total_harvest_kg at close."],
        ["survival_rate", "numeric", "Computed: (harvest_count / pl_count) × 100."],
        ["final_abw_g", "numeric", "Average body weight at harvest."],
        ["total_mortality", "integer", "Running cumulative count."],
        ["notes", "text", "Free-text post-mortem notes."],
        ["created_at", "timestamptz", ""],
        ["closed_at", "timestamptz", ""],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("5.4 Key Aquaculture Operational Records", HeadingLevel.HEADING_2, NAVY),
  spacer(40),

  // Feed Records
  para([boldRun("Feed Records (feed_entries)", { color: TEAL, size: 20 })]),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Column", 2400), hdrCell("Type", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["cycle_id", "uuid FK", ""],
        ["recorded_by", "uuid FK → users", ""],
        ["recorded_at", "timestamptz", ""],
        ["feed_time", "text", "Morning / Afternoon / Evening / Night"],
        ["quantity_kg", "numeric", ""],
        ["feed_brand", "text", "Can differ from cycle default."],
        ["doc_at_entry", "integer", "Computed from stocking_date."],
        ["tray_count_before", "integer", "Feed tray observation — amount found in tray before next feed."],
        ["notes", "text", ""],
        ["synced", "boolean", "For offline sync tracking (WatermelonDB)."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(60),

  // Water quality
  para([boldRun("Water Quality Records (water_quality_entries)", { color: TEAL, size: 20 })]),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Parameter", 2400), hdrCell("Type", 2400), hdrCell("Acceptable Range", 5280)] }),
      ...([
        ["dissolved_oxygen_ppm", "numeric", "≥ 4 ppm (alert below 3)"],
        ["ph", "numeric", "7.5 – 8.5"],
        ["salinity_ppt", "numeric", "10 – 25 ppt for L. vannamei"],
        ["temperature_c", "numeric", "26 – 32°C"],
        ["ammonia_ppm", "numeric", "< 0.1 ppm total ammonia"],
        ["nitrite_ppm", "numeric", "< 0.5 ppm"],
        ["alkalinity_ppm", "numeric", "100 – 200 ppm"],
        ["transparency_cm", "numeric", "Secchi disk depth. 25–40 cm optimal."],
        ["turbidity_ntu", "numeric", "From sensor node if available."],
        ["recorded_at", "timestamptz", ""],
        ["source", "text", "manual | sensor_node"],
        ["sensor_node_id", "text", "Populated if source = sensor_node."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(60),

  // Sampling
  para([boldRun("Sampling / ABW Records (sampling_entries)", { color: TEAL, size: 20 })]),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Column", 2400), hdrCell("Type", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["sample_count", "integer", "Number of shrimp in cast net sample."],
        ["total_weight_g", "numeric", "Weight of sample in grams."],
        ["abw_g", "numeric", "Computed: total_weight_g / sample_count."],
        ["estimated_biomass_kg", "numeric", "Computed: (pl_count × survival_est × abw_g) / 1000."],
        ["survival_estimate_pct", "numeric", "Farm team's estimated survival at sampling point."],
        ["doc_at_sampling", "integer", ""],
        ["fcr_to_date", "numeric", "Running FCR: total_feed_kg / estimated_biomass_kg."],
        ["photo_url", "text", "Optional photo of sample on scale."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(60),

  // Mortality + Disease
  para([boldRun("Mortality Records (mortality_entries)", { color: TEAL, size: 20 })]),
  para([run("Columns: cycle_id, recorded_by, recorded_at, count, cause (text enum: normal_attrition | disease | water_quality | unknown), notes, photo_url. Daily entries. Cumulative count maintained on crop_cycles.total_mortality.", { size: 20 })]),
  spacer(40),

  para([boldRun("Disease & Treatment Records (treatment_entries)", { color: TEAL, size: 20 })]),
  para([run("Columns: cycle_id, recorded_by, recorded_at, disease_observed (text), symptoms (text), product_applied (text), dosage_per_acre, application_method, withdrawal_period_days, veterinary_advised (boolean), notes, photo_urls (text[]). Legally important for traceability and export certification.", { size: 20 })]),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 6: TASK MODULE ───────────────────────────────────────────────────
const section6 = () => [
  hpara("6. Task Management Module", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("6.1 Task Model Design", HeadingLevel.HEADING_2, NAVY),
  para([run("A Task is not a checklist item. It is a data-capture form combined with a workflow state machine. Different task types have different required fields.", { size: 20 })]),
  spacer(40),

  sectionLabel("Task Table (tasks)"),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Column", 2400), hdrCell("Type", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["id", "uuid (PK)", ""],
        ["farm_id", "uuid FK", ""],
        ["pond_id", "uuid FK (nullable)", "Null = farm-level task."],
        ["cycle_id", "uuid FK (nullable)", "Null = not cycle-bound."],
        ["type", "text (enum)", "feed | water_quality | sampling | aerator_check | mortality_count | treatment | harvest_prep | custom"],
        ["title", "text", "Human-readable. Auto-filled from type for standard tasks."],
        ["assigned_to", "uuid FK → users (nullable)", "Null = unassigned (pool task)."],
        ["created_by", "uuid FK → users", ""],
        ["status", "text (enum)", "pending | in_progress | completed | verified | skipped | overdue"],
        ["priority", "text (enum)", "low | medium | high | critical"],
        ["due_date", "date", ""],
        ["time_window_start", "time", "e.g. 06:00"],
        ["time_window_end", "time", "e.g. 08:00"],
        ["is_recurring", "boolean", ""],
        ["recurrence_rule", "text (iCal RRULE)", "e.g. FREQ=DAILY;BYHOUR=6,14,20 for 3× daily feeding."],
        ["recurrence_parent_id", "uuid FK (nullable)", "Points to the template task."],
        ["form_data", "jsonb", "Recorded values when completed (varies by type)."],
        ["verification_notes", "text", "Manager's verification comment."],
        ["photo_urls", "text[]", "Completion evidence photos."],
        ["completed_at", "timestamptz", ""],
        ["verified_by", "uuid FK → users", ""],
        ["verified_at", "timestamptz", ""],
        ["skipped_reason", "text", "Required if status = skipped."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("6.2 Task Types & Required Form Fields", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2000, 8080],
    rows: [
      new TableRow({ children: [hdrCell("Task Type", 2000), hdrCell("Required form_data Fields on Completion", 8080)] }),
      ...([
        ["feed", "quantity_kg (numeric), feed_time (morning/afternoon/evening/night), tray_observation (normal/excess/deficit), notes (optional)"],
        ["water_quality", "DO (ppm), pH, temperature_c, salinity_ppt. Remaining parameters optional. At least DO + pH required."],
        ["sampling", "sample_count (integer), total_weight_g (numeric), photo of sample on scale (optional but encouraged)."],
        ["aerator_check", "aerators_checked (integer), issues_found (boolean), issue_description (text if true), photo (optional)."],
        ["mortality_count", "count (integer), cause (enum), notes (optional)."],
        ["treatment", "disease_observed, product_applied, dosage_per_acre, veterinary_advised (boolean)."],
        ["harvest_prep", "checklist (array of steps: nets_ready, oxygen_arranged, transport_booked, buyer_contacted)."],
        ["custom", "notes (text) + unlimited key-value pairs defined when task is created."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2000, i, true),
        altCell(r[1], 8080, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("6.3 Recurring Task Engine", HeadingLevel.HEADING_2, NAVY),
  para([run("Feed tasks and water checks occur 2–4 times per day. The backend generates task instances from recurring rules at midnight for the next 24 hours (or 48 during offline pre-load). The mobile app syncs these on wake. Rule stored as iCal RRULE string.", { size: 20 })]),
  spacer(40),
  para([run("Example rule for 3× daily feeding: FREQ=DAILY;BYHOUR=6,13,19;BYMINUTE=0", { size: 18, font: "Courier New", color: "8B0000" })]),
  spacer(40),
  para([run("When a cycle starts, the Manager sets up the recurring task schedule. This generates the template. New instances are materialised daily by the NestJS task scheduler (Bull queue). Closing a cycle automatically deactivates all associated recurring task templates.", { size: 20 })]),
  spacer(80),

  hpara("6.4 Task Verification Workflow", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [720, 9360],
    rows: [
      new TableRow({ children: [hdrCell("Step", 720), hdrCell("Description", 9360)] }),
      ...([
        ["1", "Worker opens task from home screen → taps 'Start Task' → status: in_progress."],
        ["2", "Worker fills required form fields. Required fields must be non-empty to submit."],
        ["3", "Worker optionally adds photo (camera or gallery). Max 3 photos per task, compressed to 800px wide on device before upload."],
        ["4", "Worker taps 'Submit' → status: completed. Push notification sent to assigning Manager/Supervisor."],
        ["5", "Manager sees task in 'Pending Approval' section of home. Views form data and photos."],
        ["6", "Manager taps 'Verify' (with optional note) → status: verified. OR taps 'Reject' with note → status: pending again, push to worker."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 720, i, true),
        altCell(r[1], 9360, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 7: ALERT SYSTEM ──────────────────────────────────────────────────
const section7 = () => [
  hpara("7. Alert & Notification System", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("7.1 Alert Trigger Definitions", HeadingLevel.HEADING_2, NAVY),
  para([run("Alerts are generated by three sources: sensor nodes (realtime), server-side rule engine (batch), and manual user reports. Every alert has a severity level and an audience.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3000, 1440, 2400, 3240],
    rows: [
      new TableRow({ children: [hdrCell("Trigger Condition", 3000), hdrCell("Severity", 1440), hdrCell("Source", 2400), hdrCell("Notified Roles", 3240)] }),
      ...([
        ["DO < 3.0 ppm", "CRITICAL", "Sensor / Manual", "Owner + Manager + Supervisor"],
        ["DO 3.0–4.0 ppm", "HIGH", "Sensor / Manual", "Manager + Supervisor"],
        ["pH < 7.0 or > 9.0", "HIGH", "Sensor / Manual", "Manager + Supervisor"],
        ["Mortality > 1% of stock in 24h", "HIGH", "Rule engine", "Owner + Manager"],
        ["Feed task overdue > 2 hours", "MEDIUM", "Rule engine", "Manager + Supervisor"],
        ["Water check not done by 9 AM", "MEDIUM", "Rule engine", "Manager"],
        ["Temperature > 34°C or < 24°C", "MEDIUM", "Sensor", "Manager + Supervisor"],
        ["Aerator failure reported", "CRITICAL", "Manual (Worker)", "Owner + Manager + Supervisor"],
        ["No activity logged for 24h on active cycle", "LOW", "Rule engine", "Manager"],
        ["Sensor node offline > 30 min", "MEDIUM", "IoT bridge", "Manager"],
        ["Inventory item below reorder level", "LOW", "Rule engine", "Manager"],
        ["Viewer access expiring in 7 days", "INFO", "Rule engine", "Owner"],
      ].map((r,i) => {
        const sevColor = r[1]==="CRITICAL"?"FFEBEE":r[1]==="HIGH"?"FFF3E0":r[1]==="MEDIUM"?"FFFDE7":"F1F8E9";
        return new TableRow({ children: [
          altCell(r[0], 3000, i),
          cell([para([boldRun(r[1], { size: 18, color: r[1]==="CRITICAL"?RED:r[1]==="HIGH"?"E65100":"827717" })])], { width: 1440, fill: sevColor, borders: allBorders() }),
          altCell(r[2], 2400, i),
          altCell(r[3], 3240, i),
        ]});
      })),
    ],
  }),
  spacer(80),

  hpara("7.2 Notification Delivery", HeadingLevel.HEADING_2, NAVY),
  para([run("Three channels are used. Priority determines which channels fire.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1800, 2880, 5400],
    rows: [
      new TableRow({ children: [hdrCell("Severity", 1800), hdrCell("Channels", 2880), hdrCell("Behaviour", 5400)] }),
      ...([
        ["CRITICAL", "Push + SMS + WhatsApp", "Immediate delivery. Re-sent if not acknowledged in 15 min."],
        ["HIGH", "Push + SMS", "Immediate. No re-send."],
        ["MEDIUM", "Push only", "Immediate. Batched into digest if app is open."],
        ["LOW / INFO", "Push (silent badge)", "Batched into daily digest. Not intrusive."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 1800, i, true),
        altCell(r[1], 2880, i),
        altCell(r[2], 5400, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 8: OFFLINE ARCHITECTURE ─────────────────────────────────────────
const section8 = () => [
  hpara("8. Offline-First Architecture", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  para([run("This is the most critical technical decision in the entire product. Shrimp farms operate in rural coastal zones with intermittent 4G and frequent zero-connectivity periods. Every data entry must succeed without an internet connection.", { size: 20, bold: true })]),
  spacer(80),

  hpara("8.1 WatermelonDB Local Storage", HeadingLevel.HEADING_2, NAVY),
  para([run("WatermelonDB runs on SQLite inside the Expo app. It mirrors the server schema locally. All writes go to WatermelonDB first and are synced to Supabase when connectivity returns.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 7680],
    rows: [
      new TableRow({ children: [hdrCell("Concern", 2400), hdrCell("Resolution", 7680)] }),
      ...([
        ["Local write", "All operational records (feed, water, sampling, tasks) are written to WatermelonDB immediately. UI responds instantly. A 'synced' flag is set to false."],
        ["Background sync", "NetInfo listener triggers sync when connectivity is detected. Expo BackgroundFetch for periodic sync (every 15 min when online)."],
        ["Conflict resolution", "Server wins for all structural data (farm settings, task assignments). Client wins for operational records (feed entries, water quality). Last-write-wins on timestamp for same-record conflicts. Conflicts are logged to a conflict_log table for manager review."],
        ["Pre-load", "On launch while online: app pulls next 48 hours of task instances, pond structure, active cycles. Ensures Worker has full task context for 2 days offline."],
        ["Photo sync", "Photos are stored in device cache. Uploaded as background tasks via Expo FileSystem when online. Task record is considered complete locally even if photos are pending upload."],
        ["Offline indicator", "Persistent banner: 'No connection — data saved locally' when offline. Disappears on sync completion."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 7680, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("8.2 Sync Protocol", HeadingLevel.HEADING_2, NAVY),
  para([run("Use WatermelonDB's built-in sync protocol (synchronize() function). NestJS provides two endpoints:", { size: 20 })]),
  spacer(40),
  bullet("GET /sync/pull?last_pulled_at={timestamp} — returns all server changes since last sync", 0),
  bullet("POST /sync/push — accepts local changes batch", 0),
  spacer(40),
  para([run("The NestJS sync controller must respect RLS — it only returns records the requesting user's farm memberships permit. Never return all rows.", { size: 20, bold: true, color: RED })]),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 9: LOCALISATION ──────────────────────────────────────────────────
const section9 = () => [
  hpara("9. Localisation & Low-End Device Strategy", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("9.1 Language Support", HeadingLevel.HEADING_2, NAVY),
  para([run("At minimum, v1 must support the three dominant shrimp-farming language zones. English is the fallback, not the default.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2000, 2800, 2880, 2400],
    rows: [
      new TableRow({ children: [hdrCell("Language", 2000), hdrCell("State Coverage", 2800), hdrCell("Priority", 2880), hdrCell("Script", 2400)] }),
      ...([
        ["Telugu", "Andhra Pradesh (60% of Indian shrimp)", "V1 — Must Have", "Telugu script"],
        ["Tamil", "Tamil Nadu", "V1 — Must Have", "Tamil script"],
        ["English", "Fallback / educated users", "V1 — Must Have", "Latin"],
        ["Odia", "Odisha (fastest growing)", "V2", "Odia script"],
        ["Gujarati", "Gujarat (HDPE pond intensive)", "V2", "Gujarati script"],
        ["Bengali", "West Bengal", "V2", "Bengali script"],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2000, i, true),
        altCell(r[1], 2800, i),
        altCell(r[2], 2880, i),
        altCell(r[3], 2400, i),
      ]}))),
    ],
  }),
  spacer(60),
  para([run("Implementation: i18next + expo-localization. All strings in /locales/{lang}.json. Date/number formatting via Intl. Right-to-left not required for v1 languages.", { size: 20 })]),
  spacer(80),

  hpara("9.2 Low-End Android Device Strategy", HeadingLevel.HEADING_2, NAVY),
  para([run("Target device: ₹6,000–₹12,000 Android. 2 GB RAM, 32 GB storage, Android 10+, 4.7–5.5 inch screen, variable network.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 7280],
    rows: [
      new TableRow({ children: [hdrCell("Constraint", 2800), hdrCell("Design Response", 7280)] }),
      ...([
        ["Small screen (4.7\")", "Minimum touch target 48×48dp. Bottom navigation (thumb zone). No horizontal scroll for primary content. Font size minimum 16sp."],
        ["2 GB RAM", "No heavy chart libraries on list screens. Charts lazy-loaded only on detail screens. Virtualized lists (FlashList) everywhere."],
        ["Slow processor", "No JS animations on data-heavy screens. React Native Reanimated only for critical UX (task swipe). SVG charts avoided on low-RAM path."],
        ["Limited storage", "WatermelonDB cache limit: 90 days of records. Photos compressed to 200KB before local store. Sync cleans stale records older than 6 months."],
        ["Variable network", "No full-page loading spinners. Skeleton screens with cached data. Optimistic UI for all writes (show success immediately, sync in background)."],
        ["Literacy variance", "Icons + text labels always together. Voice input for notes fields (expo-speech). Photo evidence reduces text dependency for workers."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 7280, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 10: EXTENDED FEATURES ───────────────────────────────────────────
const section10 = () => [
  hpara("10. Extended Feature Modules", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("10.1 Calculators", HeadingLevel.HEADING_2, NAVY),
  para([run("Accessible from the Tools tab. All calculators work 100% offline (pure local computation).", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 3240, 4040],
    rows: [
      new TableRow({ children: [hdrCell("Calculator", 2800), hdrCell("Inputs", 3240), hdrCell("Outputs", 4040)] }),
      ...([
        ["FCR Calculator", "Total feed used (kg), total harvest (kg)", "FCR ratio, cost efficiency grade"],
        ["Stocking Density", "Pond area (acres), target PL/m²", "Total PL count to stock"],
        ["Feed Quantity Estimator", "ABW (g), pond population est., feeding rate (%)", "Daily feed requirement (kg) per feeding round"],
        ["Harvest Estimator", "Latest ABW, survival estimate, PL stocked", "Estimated harvest weight (kg)"],
        ["Lime / Probiotics Dose", "Pond area, water volume est., product type", "Application dose (kg)"],
        ["DO Correction", "Current DO, temperature, salinity", "Saturation DO, deficit, aerator load estimate"],
        ["Profit/Loss Estimator", "Feed cost, seed cost, labour cost, misc costs; harvest weight; market price", "Gross revenue, net profit, margin %"],
        ["Water Volume", "Pond area (m²), average depth (m)", "Total water volume (litres / cubic metres)"],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 3240, i),
        altCell(r[2], 4040, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("10.2 Inventory Management", HeadingLevel.HEADING_2, NAVY),
  para([run("Tracks consumables at farm level: feed bags, probiotics, mineral supplements, chemicals, fuel, aerator parts.", { size: 20 })]),
  spacer(40),
  para([boldRun("inventory_items table: ", { size: 20, color: TEAL }), run("id, farm_id, name, category, unit, current_stock, reorder_level, unit_cost, supplier_name, last_restocked_at.", { size: 20 })]),
  para([boldRun("inventory_transactions table: ", { size: 20, color: TEAL }), run("id, item_id, type (in/out/adjustment), quantity, reference_type (purchase/task_use/manual), reference_id, recorded_by, recorded_at, notes.", { size: 20 })]),
  spacer(40),
  para([run("Feed entries auto-deduct from feed inventory when recorded. Inventory widget on Manager Home shows low-stock items. Alerts fire when stock crosses reorder_level.", { size: 20 })]),
  spacer(80),

  hpara("10.3 Cost Management", HeadingLevel.HEADING_2, NAVY),
  para([run("Cost records are attached to a crop cycle and categorised. A cycle cost summary is generated on close.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2400, 5280],
    rows: [
      new TableRow({ children: [hdrCell("Cost Category", 2400), hdrCell("How Captured", 2400), hdrCell("Notes", 5280)] }),
      ...([
        ["Seed (PL) cost", "At cycle start", "Total PL × price per thousand PLs."],
        ["Feed cost", "Auto from feed entries × unit cost from inventory", "Requires feed item to be in inventory with unit_cost set."],
        ["Labour cost", "Manual entry (weekly or cycle-end)", "Per-worker or lump sum."],
        ["Pond preparation", "Manual entry at cycle start", "Lime, tilling, water treatment."],
        ["Medicine / treatment", "Auto from treatment entries × cost from inventory", ""],
        ["Electricity / fuel", "Manual entry (monthly or cycle)", ""],
        ["Miscellaneous", "Manual free-form entry", ""],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5280, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("10.4 Simulations", HeadingLevel.HEADING_2, NAVY),
  para([run("Scenario simulations let owners model outcomes before making decisions. All simulations are local computations — no API call needed.", { size: 20 })]),
  spacer(40),
  bullet("Harvest timing simulation: given current ABW trajectory, model harvest weight and revenue at DOC 90, 100, 110, 120", 0),
  bullet("Feed budget simulation: adjust feeding rate and model impact on FCR, harvest weight, and cost", 0),
  bullet("Stocking scenario: compare yield projections for different PL densities", 0),
  bullet("Price sensitivity: model profit/loss at different market price per kg", 0),
  spacer(80),

  hpara("10.5 Ecommerce / Marketplace", HeadingLevel.HEADING_2, NAVY),
  para([run("The marketplace connects farmers with certified input suppliers (feed, seed, chemicals, aerators) and enables harvest pre-booking with processors.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 7680],
    rows: [
      new TableRow({ children: [hdrCell("Feature", 2400), hdrCell("Description", 7680)] }),
      ...([
        ["Input catalogue", "Searchable catalogue of feed brands, probiotics, chemicals with verified pricing. Filterable by state (prices vary by region)."],
        ["Order placement", "Owner/Manager can place orders. Auto-fill from inventory reorder suggestions."],
        ["Harvest listing", "Owner can list upcoming harvest: expected weight, harvest date, species, size. Visible to registered processors and aggregators."],
        ["Order tracking", "Status: placed → confirmed → dispatched → delivered. Push updates."],
        ["Payment", "Cash on delivery (primary) + UPI integration (PhonePe/GPay via Razorpay)."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 7680, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("10.6 Reports", HeadingLevel.HEADING_2, NAVY),
  para([run("Generated as PDF (Supabase Storage) and viewable in-app. Shareable via WhatsApp.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 3200, 4080],
    rows: [
      new TableRow({ children: [hdrCell("Report Name", 2800), hdrCell("Frequency", 3200), hdrCell("Key Data", 4080)] }),
      ...([
        ["Cycle Summary Report", "On cycle close", "FCR, survival rate, ABW progression, cost breakdown, P&L."],
        ["Daily Operations Report", "Daily (auto-generated)", "Tasks completed %, feed summary, water quality summary, alerts."],
        ["Pond Performance Report", "Monthly", "Cycle history, average FCR, trend charts."],
        ["Traceability Report", "On demand / at harvest", "Full chain from stocking → feed → treatment → harvest. For export certification."],
        ["Worker Productivity Report", "Weekly (for Manager)", "Tasks assigned vs completed per worker."],
        ["Financial Summary", "Monthly / Cycle", "Revenue, cost by category, profit margin."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 3200, i),
        altCell(r[2], 4080, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("10.7 Traceability", HeadingLevel.HEADING_2, NAVY),
  para([run("Traceability creates an immutable audit chain from PL source through entire production lifecycle to harvest. Required for export certification (MPEDA, APEDA, ASC/BAP). Key design principle: every significant event in a cycle is a signed, timestamped record that cannot be edited — only annotated.", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 7280],
    rows: [
      new TableRow({ children: [hdrCell("Traceability Event", 2800), hdrCell("Data Captured", 7280)] }),
      ...([
        ["Stocking", "PL source hatchery, certification number, species, count, health certificate photo."],
        ["Feed usage", "Every feed entry: brand, lot number (if available), quantity, DOC."],
        ["Water quality", "All parameter readings with timestamps and source (manual or sensor)."],
        ["Chemical / treatment", "Product name, registration number, dose, withdrawal period, vet name."],
        ["Sampling", "ABW progression with photos."],
        ["Harvest", "Date, weight, buyer name, vehicle registration, cold chain confirmation."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 7280, i),
      ]}))),
    ],
  }),
  para([run("Hash-chain integrity: each record stores SHA-256(previous_record_hash + current_record_data). This creates a tamper-evident chain. A separate traceability_chain table stores these hashes. A full blockchain (on-chain) is deferred to v3 — the hash-chain provides sufficient integrity for domestic and most export certifications.", { size: 20, color: "555555", italics: true })]),
  spacer(80),

  hpara("10.8 Custom Sensor Hardware Integration", HeadingLevel.HEADING_2, NAVY),
  para([run("Upcheck's sensor nodes are ESP32-based, transmitting via GSM (SIM800) to AWS IoT Core over MQTT. The integration architecture:", { size: 20 })]),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 7680],
    rows: [
      new TableRow({ children: [hdrCell("Layer", 2400), hdrCell("Details", 7680)] }),
      ...([
        ["On-node", "ESP32 reads DO, pH, temperature, turbidity sensors. Publishes to MQTT topic: upcheck/farm/{farm_id}/pond/{pond_id}/telemetry"],
        ["IoT Core", "AWS IoT Core receives, validates, and routes. IoT Rule triggers Lambda to write to InfluxDB (time-series) and Supabase (water_quality_entries)."],
        ["NestJS", "Subscribes to IoT Core via WebSocket bridge. Evaluates alert thresholds in realtime. Publishes alerts to notification queue."],
        ["App", "Supabase Realtime subscription on water_quality_entries for active ponds. Sensor readings appear on pond screen within 30s of node transmission."],
        ["Pairing", "Owner/Manager pairs a sensor node to a pond via QR code scan (node's MAC address encoded in QR). Stored in ponds.sensor_node_ids array."],
        ["Offline nodes", "If no telemetry in 30 min for an active cycle: MEDIUM alert. If no telemetry in 2 hours: HIGH alert. Node battery level transmitted with each reading."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 7680, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 11: SUPABASE RLS ─────────────────────────────────────────────────
const section11 = () => [
  hpara("11. Supabase Row-Level Security", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  para([run("All data access is enforced at the database layer using Supabase RLS policies. The NestJS backend uses a service role key for server-side operations only. The mobile app uses user JWTs which are governed by RLS.", { size: 20 })]),
  spacer(40),

  hpara("11.1 Core RLS Pattern", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  para([run("The central pattern for all farm-scoped tables:", { size: 20 })]),
  spacer(20),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [cell(
      [
        para([code("-- User can see a farm's records only if they are an active member")]),
        para([code("CREATE POLICY farm_member_select ON ponds")]),
        para([code("FOR SELECT USING (")]),
        para([code("  farm_id IN (")]),
        para([code("    SELECT farm_id FROM farm_memberships")]),
        para([code("    WHERE user_id = auth.uid()")]),
        para([code("    AND status = 'active'")]),
        para([code("  )")]),
        para([code(");")]),
      ],
      { width: CONTENT_W, fill: "1A1A2E", borders: allBorders("1A1A2E") }
    )]})],
  }),
  spacer(60),

  hpara("11.2 Role-Scoped Write Policies", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, 2000, 5680],
    rows: [
      new TableRow({ children: [hdrCell("Table", 2400), hdrCell("Operation", 2000), hdrCell("Policy Condition", 5680)] }),
      ...([
        ["farms", "DELETE", "owner_id = auth.uid()"],
        ["farms", "UPDATE settings", "membership role IN ('owner')"],
        ["ponds", "INSERT / DELETE", "membership role IN ('owner', 'manager')"],
        ["crop_cycles", "INSERT / UPDATE status", "membership role IN ('owner', 'manager')"],
        ["crop_cycles", "UPDATE (operational fields)", "membership role IN ('owner', 'manager', 'supervisor', 'worker') — but field-level via NestJS, not RLS"],
        ["feed_entries", "INSERT", "membership role IN ('owner', 'manager', 'supervisor', 'worker')"],
        ["tasks", "INSERT (assign)", "membership role IN ('owner', 'manager', 'supervisor')"],
        ["tasks", "UPDATE (complete)", "assigned_to = auth.uid() OR membership role IN ('owner','manager','supervisor')"],
        ["tasks", "UPDATE (verify)", "membership role IN ('owner', 'manager', 'supervisor')"],
        ["farm_memberships", "INSERT new member", "Actor's membership role = 'owner' OR ('manager' and new role IN ('supervisor','worker'))"],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2400, i, true),
        altCell(r[1], 2000, i),
        altCell(r[2], 5680, i),
      ]}))),
    ],
  }),
  spacer(40),
  para([run("NestJS guards handle fine-grained permission checks that RLS cannot express (e.g. field-level write restrictions, cross-farm constraints). RLS is the safety net; NestJS guards are the primary enforcement layer.", { size: 20, italics: true, color: "555555" })]),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 12: MVP SCOPE ────────────────────────────────────────────────────
const section12 = () => [
  hpara("12. MVP Scope & Build Sequencing", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  hpara("12.1 Revised MVP Definition", HeadingLevel.HEADING_2, NAVY),
  para([run("The MVP is owner-centric with worker task execution as the operational proof point. It proves the core feedback loop: Owner sets up farm → Manager assigns tasks → Worker executes and records → Manager verifies → Owner sees performance summary.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1440, 3240, 2880, 2520],
    rows: [
      new TableRow({ children: [hdrCell("Phase", 1440), hdrCell("Features", 3240), hdrCell("Duration (est.)", 2880), hdrCell("Success Metric", 2520)] }),
      ...([
        ["V1.0 — Core", "Auth (OTP + PIN), Farm setup, Pond management, Crop cycle start/close, Feed recording, Water quality recording, Sampling/ABW, Mortality logging, Task assignment + completion, Owner/Manager/Worker home screens, Offline mode, Telugu + Tamil + English", "10–14 weeks (small team)", "10 farms logging data daily for 30 days"],
        ["V1.1 — Verification & Alerts", "Task verification workflow, Alert engine (DO, mortality, missed tasks), Push + SMS notifications, Recurring task templates, Sampling-based FCR calculation", "4–6 weeks", "Alert response rate > 80%"],
        ["V1.2 — Reporting & Calculators", "Cycle summary report (PDF), Daily operations digest, Offline calculators (8 types), Inventory tracking (basic)", "4 weeks", "Cycle reports generated for all closed cycles"],
        ["V2.0 — Extended", "Cost management, Traceability chain, Viewer role, Ecommerce marketplace, Revenue simulation, IoT sensor integration UI, Odia + Gujarati", "12–16 weeks", "Revenue from marketplace transactions"],
        ["V3.0 — Intelligence", "AI-driven feed recommendations, Disease early warning, Harvest timing optimisation, On-chain traceability, Finance analytics", "Ongoing", "FCR improvement benchmark across user farms"],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 1440, i, true),
        altCell(r[1], 3240, i),
        altCell(r[2], 2880, i),
        altCell(r[3], 2520, i),
      ]}))),
    ],
  }),
  spacer(80),

  hpara("12.2 What Is Explicitly Deferred from V1", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [4040, 6040],
    rows: [
      new TableRow({ children: [hdrCell("Deferred Feature", 4040), hdrCell("Reason", 6040)] }),
      ...([
        ["Revenue Forecast on home screen", "Requires price data pipeline and biomass model not available in v1. Placeholder damages trust."],
        ["Ecommerce / Marketplace", "Supplier onboarding is a separate operational workstream. Not required to prove farm management value."],
        ["IoT sensor realtime dashboard", "Hardware supply chain is independent. App should work without sensors."],
        ["Financial reporting / P&L", "Requires cost capture at cycle level. Cost management feature comes first."],
        ["Traceability hash chain", "MVP farms don't export. Certification pipeline is v2 priority."],
        ["Viewer role", "No external stakeholder demand until farm count justifies it."],
        ["AI recommendations", "Need 6+ months of historical data per farm to be useful. Don't fake it."],
        ["Simulations", "Good-to-have. Calculators cover immediate decision support needs."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 4040, i, true),
        altCell(r[1], 6040, i),
      ]}))),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 13: OPEN QUESTIONS ───────────────────────────────────────────────
const section13 = () => [
  hpara("13. Decision Log — Questions Requiring Product Owner Answer", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),
  para([run("These decisions must be documented before a developer writes a line of code. The table below tracks open items.", { size: 20 })]),
  spacer(40),

  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [720, 4320, 1800, 3240],
    rows: [
      new TableRow({ children: [hdrCell("#", 720), hdrCell("Question", 4320), hdrCell("Status", 1800), hdrCell("Notes", 3240)] }),
      ...([
        ["1", "Can a Manager create a new pond, or only Owner?", "RESOLVED (Manager can)", "See permissions matrix §2.5"],
        ["2", "What is the exact recurrence rule interface for non-technical Managers?", "OPEN", "Consider: simple dropdowns (2×/day, 3×/day) vs advanced RRULE editor."],
        ["3", "How is farm_code regenerated after a security breach?", "OPEN", "Old code must be invalidated. Need grace period for workers mid-join?"],
        ["4", "Is Supervisor role wanted for v1 or deferred?", "OPEN", "Adds complexity. May simplify if just Owner/Manager/Worker for MVP."],
        ["5", "Which WhatsApp Business API provider? (Meta direct, Twilio, Gupshup, etc.)", "OPEN", "Cost and approval timeline differs significantly."],
        ["6", "Is there a SaaS subscription model for farms, or is it free during beta?", "OPEN", "Determines whether paywall logic needs to be built into v1 auth."],
        ["7", "What is the data retention policy for a farm that stops paying?", "OPEN", "Read-only for 90 days? Export allowed? Purge after 1 year?"],
        ["8", "How are sensor nodes provisioned — by Upcheck team or self-service?", "OPEN", "Determines whether onboarding flow for sensor setup is in app or out-of-band."],
        ["9", "Is Bengali or Odia a higher priority for v2 language expansion?", "OPEN", "Depends on BD/Odisha farm partnership pipeline."],
        ["10", "Who pays for SMS notifications — farm or Upcheck?", "OPEN", "Must be decided before notification architecture is finalised."],
      ].map((r,i) => {
        const statusColor = r[2]==="RESOLVED"?"E8F5E9":"FFF3E0";
        return new TableRow({ children: [
          altCell(r[0], 720, i, true),
          altCell(r[1], 4320, i),
          cell([para([boldRun(r[2], { size: 18, color: r[2]==="RESOLVED"?GREEN:ACCENT })])], { width: 1800, fill: statusColor, borders: allBorders() }),
          altCell(r[3], 3240, i),
        ]});
      })),
    ],
  }),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECTION 14: WHATSAPP & SMS ──────────────────────────────────────────────
const section14 = () => [
  hpara("14. WhatsApp & SMS Integration Strategy", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(80),

  para([run("WhatsApp is not a competitor to Upcheck — it is a delivery channel. Indian farm workers trust WhatsApp notifications more than push notifications from unknown apps. The Upcheck approach treats WhatsApp as a primary notification and onboarding surface.", { size: 20 })]),
  spacer(80),

  hpara("14.1 WhatsApp Use Cases", HeadingLevel.HEADING_2, NAVY),
  spacer(40),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 7280],
    rows: [
      new TableRow({ children: [hdrCell("Use Case", 2800), hdrCell("Implementation", 7280)] }),
      ...([
        ["Worker invitation", "Owner sends invite. System sends WhatsApp message: 'Ravi Kumar has invited you to join Farm A on Upcheck. Code: AB3X7K. Download: [link]'"],
        ["CRITICAL alert", "Immediate WhatsApp + SMS. Template: 'ALERT [Farm A / Pond 3]: Dissolved Oxygen is LOW (2.8 ppm). Check aerators immediately. — Upcheck'"],
        ["Daily task reminder", "Morning broadcast to each worker: their task list for the day. WhatsApp message with task names and pond assignments."],
        ["Cycle close notification", "Owner receives WhatsApp with cycle summary: FCR, harvest weight, gross revenue estimate."],
        ["App download / onboarding", "Invite deep link opens Play Store if app not installed. Falls back to web PWA."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 7280, i),
      ]}))),
    ],
  }),
  spacer(60),
  para([run("Technical: WhatsApp Business API via approved provider (Gupshup recommended for India pricing). All templates pre-approved. Fallback: Twilio SMS for all CRITICAL alerts regardless of WhatsApp status.", { size: 20 })]),
  spacer(160),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── APPENDIX ─────────────────────────────────────────────────────────────────
const appendix = () => [
  hpara("Appendix A: Database Table Summary", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(60),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 3640, 3640],
    rows: [
      new TableRow({ children: [hdrCell("Table", 2800), hdrCell("Primary Key", 3640), hdrCell("Foreign Keys & Notes", 3640)] }),
      ...([
        ["users", "id (uuid)", "Managed by Supabase Auth."],
        ["farms", "id (uuid)", "owner_id → users"],
        ["farm_memberships", "id (uuid)", "farm_id → farms, user_id → users. Unique (farm_id, user_id)."],
        ["ponds", "id (uuid)", "farm_id → farms"],
        ["crop_cycles", "id (uuid)", "pond_id → ponds, farm_id → farms"],
        ["feed_entries", "id (uuid)", "cycle_id → crop_cycles, recorded_by → users"],
        ["water_quality_entries", "id (uuid)", "cycle_id → crop_cycles, pond_id → ponds"],
        ["sampling_entries", "id (uuid)", "cycle_id → crop_cycles"],
        ["mortality_entries", "id (uuid)", "cycle_id → crop_cycles"],
        ["treatment_entries", "id (uuid)", "cycle_id → crop_cycles"],
        ["tasks", "id (uuid)", "farm_id, pond_id, cycle_id, assigned_to, created_by → users"],
        ["alerts", "id (uuid)", "farm_id, pond_id (nullable), cycle_id (nullable), triggered_by → users (nullable for system alerts)"],
        ["inventory_items", "id (uuid)", "farm_id → farms"],
        ["inventory_transactions", "id (uuid)", "item_id → inventory_items"],
        ["cost_entries", "id (uuid)", "cycle_id → crop_cycles, farm_id → farms"],
        ["traceability_chain", "id (uuid)", "cycle_id → crop_cycles. Stores record_hash, previous_hash, record_type, record_id, timestamp."],
        ["notification_log", "id (uuid)", "Stores all sent notifications with delivery status."],
        ["conflict_log", "id (uuid)", "Offline sync conflict records for manager review."],
        ["viewer_tokens", "id (uuid)", "farm_id → farms, user_id → users. expires_at timestamptz."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2800, i, true),
        altCell(r[1], 3640, i),
        altCell(r[2], 3640, i),
      ]}))),
    ],
  }),
  spacer(160),

  hpara("Appendix B: Key Indian Aquaculture Terms", HeadingLevel.HEADING_1, TEAL),
  divider(),
  spacer(60),
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2000, 2400, 5680],
    rows: [
      new TableRow({ children: [hdrCell("Term", 2000), hdrCell("Full Form", 2400), hdrCell("Definition", 5680)] }),
      ...([
        ["PL", "Post-Larvae", "Juvenile shrimp stocked at cycle start. PL count is the starting population."],
        ["ABW", "Average Body Weight", "Mean weight of shrimp in grams. Measured via cast-net sampling."],
        ["FCR", "Feed Conversion Ratio", "kg of feed consumed per kg of shrimp produced. Lower = more efficient."],
        ["DOC", "Days of Culture", "Days since stocking. Every operational decision is referenced against DOC."],
        ["DO", "Dissolved Oxygen", "Oxygen level in pond water (ppm). Below 4 ppm is dangerous."],
        ["ABW", "Average Body Weight", ""],
        ["HDPE", "High-Density Polyethylene", "Lining material for intensive ponds."],
        ["MPEDA", "Marine Products Export Development Authority", "Indian body for seafood export certification."],
        ["APEDA", "Agricultural and Processed Food Products Export Development Authority", "Governs processed food exports including shrimp."],
        ["ASC", "Aquaculture Stewardship Council", "International certification for responsible aquaculture."],
        ["BAP", "Best Aquaculture Practices", "Global certification by Global Seafood Alliance."],
        ["L. vannamei", "Litopenaeus vannamei", "Pacific white shrimp. Dominant species in Indian aquaculture (~90% of production)."],
      ].map((r,i) => new TableRow({ children: [
        altCell(r[0], 2000, i, true),
        altCell(r[1], 2400, i),
        altCell(r[2], 5680, i),
      ]}))),
    ],
  }),
];

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ════════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: "Arial", size: 20 } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: "Arial", size: 20 } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20, color: BLACK } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: TEAL },
        paragraph: { spacing: { before: 480, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 360, after: 80 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2E6DA4" },
        paragraph: { spacing: { before: 240, after: 60 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Upcheck ", font: "Arial", size: 18, bold: true, color: TEAL }),
                new TextRun({ text: "— Product Architecture & Developer Specification", font: "Arial", size: 18, color: "888888" }),
                new TextRun({ text: "\tConfidential", font: "Arial", size: 18, color: "AAAAAA" }),
              ],
              tabStops: [{ type: "right", position: 9360 }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MGRAY, space: 1 } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "© Upcheck 2025  ·  ", font: "Arial", size: 16, color: "AAAAAA" }),
                new TextRun({ text: "Page ", font: "Arial", size: 16, color: "AAAAAA" }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: NAVY }),
              ],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: MGRAY, space: 1 } },
            }),
          ],
        }),
      },
      children: [
        ...coverPage(),
        ...tocSection(),
        ...section1(),
        ...section2(),
        ...section3(),
        ...section4(),
        ...section5(),
        ...section6(),
        ...section7(),
        ...section8(),
        ...section9(),
        ...section10(),
        ...section11(),
        ...section12(),
        ...section13(),
        ...section14(),
        ...appendix(),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/mnt/user-data/outputs/Upcheck_Architecture_Spec.docx", buffer);
  console.log("Done. Written to /mnt/user-data/outputs/Upcheck_Architecture_Spec.docx");
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});