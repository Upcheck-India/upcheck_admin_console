'use strict';
// One-off: converts every EXISTING changelog entry (as of when this is run)
// to displayMode 'silent', so none of them keep surfacing as a banner/popup
// for users who haven't dismissed one yet. This was needed because the
// v1.0.0->v3.4.1 backfill went out via the real API (not a direct DB write),
// so there was no way to pre-mark historical entries as "seen" for existing
// users — GET /api/changelogs/unseen was returning a fresh "latest unseen"
// entry every time the previous one got dismissed, cascading through the
// whole history one popup/banner at a time.
//
// Entries created AFTER this script runs are unaffected — they'll surface
// normally per whatever displayMode the console's changelog editor sets for
// them (banner/popup/forced/full_page/silent).
//
// Usage: node scripts/silence_existing_changelogs.cjs
// Prompts for your admin_token (from the browser's admin_token cookie on
// erp.upcheck.in) — never hardcode a real token into this file.

const API_BASE = 'https://erp.upcheck.in/api';

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
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const listRes = await fetch(`${API_BASE}/changelogs?all=true`, { headers });
  const listData = await listRes.json();
  if (!listRes.ok) {
    console.error('Failed to list changelogs:', listRes.status, listData);
    process.exit(1);
  }
  const entries = listData.changelogs || [];
  console.log(`Found ${entries.length} existing changelog entries.`);

  let updated = 0;
  for (const entry of entries) {
    if (entry.displayMode === 'silent') {
      console.log(`SKIP ${entry.version || '(no version)'} - ${entry.title} (already silent)`);
      continue;
    }
    const res = await fetch(`${API_BASE}/changelogs/${entry._id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        title: entry.title,
        body: entry.body,
        version: entry.version,
        displayMode: 'silent',
        publish: entry.isPublished,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`FAILED ${entry.version || entry._id}:`, res.status, data);
      continue;
    }
    updated++;
    console.log(`OK ${entry.version || '(no version)'} - ${entry.title}`);
  }
  console.log(`Done. ${updated} entries switched to silent.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
