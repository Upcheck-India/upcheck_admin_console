'use strict';
// One-off: backfills the "What's New" changelog history from v1.0.0 to
// v3.4.1, grounded in the real app git commit history. Posts each entry
// through the real POST /api/changelogs endpoint (normal auth/RBAC path,
// same as using the admin console by hand) rather than writing to MongoDB
// directly. All entries except the latest are created with displayMode
// 'banner' (quiet) rather than a popup, since there's no way to pre-mark
// them "seen" for existing users without a direct DB write -- this avoids a
// cascade of forced popups when the backfill runs.
//
// Usage: node scripts/backfill_changelogs.js
// It will prompt for your admin_token (from the browser's admin_token
// cookie on erp.upcheck.in) -- never hardcode a real token into this file.

const API_BASE = 'https://erp.upcheck.in/api';

const ENTRIES = [
  { version: '1.0.0', title: 'Upcheck ERP Mobile Launch',
    body: 'Welcome to Upcheck ERP on mobile. This first release includes secure sign-in, push notifications, and the core app navigation.' },
  { version: '1.1.0', title: 'Home Dashboard & Conversations',
    body: 'Redesigned home dashboard, a new conversations inbox, live online presence, a security center, filterable notifications, over-the-air app updates, a DiceBear avatar picker, and Team Chat.' },
  { version: '1.2.0', title: 'Announcements & Richer Team Chat',
    body: 'Announcements with emoji reactions and a history feed. Team Chat gained styled @mentions, swipe-to-reply, and unread/mention badges.' },
  { version: '1.3.0', title: 'Direct Messages & Group Chats',
    body: '1:1 messaging with read receipts, reply, and delete. Brand-new Group Chats, plus chat muting and group settings.' },
  { version: '1.4.0', title: 'Meetings & Media Sharing',
    body: 'Meetings phase 2, and image sharing in chat with background uploads, progress tracking, retry on failure, and multi-image sending.' },
  { version: '1.5.0', title: 'Themes & Chat Polish',
    body: 'A pluggable app theme engine, secure link previews, typing indicators in group chats, and a unified message action menu.' },
  { version: '1.6.0', title: 'Meet the Upcheck Bot',
    body: 'Cross-chat @mention autocomplete, plus an AI assistant (Upcheck Admin Bot) with streaming replies, markdown and table rendering, and a crash-proof error screen.' },
  { version: '1.7.0', title: 'App Store & Session Management',
    body: 'An internal App Store for distributing and installing company APKs, a devices & sessions manager, and unread badges with read-all in the inbox.' },
  { version: '2.0.0', title: 'Messaging Overhaul',
    body: 'A rebuilt DM settings panel, improved read receipts and typing indicators, smarter notifications, and an access-control wizard for the App Store.' },
  { version: '2.1.0', title: 'GIFs, Secure Sign-in & More',
    body: 'GIF search and sending via Giphy, biometric/passkey sign-in, group admin roles, resumable App Store uploads, and custom notification sounds.' },
  { version: '2.2.0', title: 'Realtime Messaging Goes Live',
    body: 'Presence, typing, and new messages now deliver instantly over a live connection, with automatic fallback if your connection is unstable.' },
  { version: '2.3.0', title: 'Reactions & Reliability',
    body: 'Emoji reactions on messages, an update-available indicator on Home, chat media display fixes, and smarter background refreshing.' },
  { version: '2.4.0', title: 'Unified Attachments & Polls',
    body: 'One + button for photos, GIFs, and polls -- plus WhatsApp-style polls across DMs, Groups, and Teams.' },
  { version: '2.5.0', title: 'Pinning & Profile Photos',
    body: 'Pin important messages, upload a group avatar, set a custom profile photo with cropping, and manage chat participant settings.' },
  { version: '2.6.0', title: 'Message Editing',
    body: 'Edit messages after sending, quick three-dot action menus, and safer search & pinned-message screens.' },
  { version: '3.0.0', title: "Full Realtime & What's New",
    body: 'Live in-app notifications complete the realtime rollout. Also new: this What’s New changelog center, cropping photos before you send them, and a connection status indicator.' },
  { version: '3.1.0', title: 'Profile Sharing',
    body: 'Share your profile via link or QR code so people can connect with you instantly, with privacy-respecting profile previews.' },
  { version: '3.2.0', title: 'Project Management & Faster Presence',
    body: 'Browse your projects, tasks, and team leaderboards right from the app (read-only). Online status now updates in real time, reliably.' },
  { version: '3.3.0', title: 'Reactions Fixed & Leave Group',
    body: 'Fixed emoji reactions rendering incorrectly in chat. Added the ability to leave a group chat -- safely, with admin handoff required if you’re the only admin.' },
  { version: '3.4.0', title: 'Smarter Mentions & Faster Sending',
    body: 'More accurate @mentions (no more accidental false matches), and messages now send and appear instantly across DMs, Groups, and Teams.' },
  { version: '3.4.1', title: 'Messaging Guide & Polish',
    body: 'A new in-app Messaging Guide (tap the ? in your Inbox) walks through sending, reactions, mentions, and more. What’s New now lives right next to your app version. Various refinements.' },
];

function promptForToken() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Paste your admin_token and press Enter: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const token = process.env.ADMIN_TOKEN || (await promptForToken());
  if (!token) throw new Error('No token provided');

  for (const [idx, entry] of ENTRIES.entries()) {
    const isLatest = idx === ENTRIES.length - 1;
    const res = await fetch(`${API_BASE}/changelogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: entry.title,
        body: entry.body,
        version: entry.version,
        displayMode: isLatest ? 'popup' : 'banner',
        publish: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`FAILED ${entry.version}:`, res.status, data);
      process.exit(1);
    }
    console.log(`OK ${entry.version} - ${entry.title} (id ${data.changelog?._id})`);
  }
  console.log('All entries created.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
