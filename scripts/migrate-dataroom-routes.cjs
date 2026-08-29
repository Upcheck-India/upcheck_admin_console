#!/usr/bin/env node
/**
 * One-shot codemod: move data room routes onto withDataroomAuth.
 *
 * The mechanical part of the migration is identical across ~50 files — strip
 * the copy-pasted getUserFromToken/isAdminLike helpers, convert
 * `export async function GET(request, { params })` into
 * `export const GET = withDataroomAuth(async (request, ctx) => {...}, opts)`,
 * drop the now-duplicated clientPromise/db lines and the outer try/catch the
 * wrapper already provides.
 *
 * The part that is NOT mechanical is which permission each handler requires.
 * That lives in ROUTES below, one entry per file, and is the thing to review.
 *
 * The codemod is deliberately conservative: any file that does not match the
 * expected shape is reported and left untouched for manual conversion. Run it
 * once, then delete it.
 *
 * Usage: node scripts/migrate-dataroom-routes.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const ROOT = path.join('src', 'app', 'api', 'dataroom');

// ── Permission map ────────────────────────────────────────────────────────
// Verbs are the ones actually stored in dataroom_permissions:
//   view | comment | edit | download | print | admin
//
// Reading is `view`. Adding content is `edit`. Discussion is `comment`.
// Anything that changes who can see what — permissions, groups, parties,
// branding, quota, audit — is `admin`.
const R = (type, param = 'id') => ({ type, param });
const ROOM_Q = { type: 'room', query: 'roomId' };

const ROUTES = {
  // ── Document-scoped ────────────────────────────────────────────────────
  'documents/[id]': { GET: 'view', PUT: 'edit', DELETE: 'edit', resource: R('document') },
  'documents/[id]/activity': { GET: 'view', resource: R('document') },
  'documents/[id]/comments': { GET: 'view', POST: 'comment', resource: R('document') },
  'documents/[id]/lock': { POST: 'edit', DELETE: 'edit', resource: R('document') },
  'documents/[id]/state': { GET: 'view', PUT: 'edit', resource: R('document') },
  'documents/[id]/versions': { GET: 'view', POST: 'edit', resource: R('document') },
  'documents/[id]/versions/[versionId]': { GET: 'view', DELETE: 'edit', resource: R('document') },
  'documents/[id]/versions/[versionId]/restore': { POST: 'edit', resource: R('document') },
  'documents/[id]/versions/compare': { GET: 'view', resource: R('document') },

  // ── Folder-scoped ──────────────────────────────────────────────────────
  'folders/[id]': { GET: 'view', PUT: 'edit', DELETE: 'edit', resource: R('folder') },
  'folders': { GET: 'view', POST: 'edit', resource: ROOM_Q },

  // ── Room-scoped ────────────────────────────────────────────────────────
  'rooms/[id]': { GET: 'view', PUT: 'admin', DELETE: 'admin', resource: R('room') },
  'rooms/[id]/branding': { GET: 'view', PUT: 'admin', resource: R('room') },
  'rooms/[id]/parties': { GET: 'view', POST: 'admin', PUT: 'admin', DELETE: 'admin', resource: R('room') },
  'rooms/[id]/quota': { GET: 'view', PUT: 'admin', resource: R('room') },
  'rooms/[id]/users': { GET: 'admin', resource: R('room') },

  // ── Room-query collections ─────────────────────────────────────────────
  'analytics': { GET: 'view', resource: ROOM_Q },
  'audit': { GET: 'admin', resource: ROOM_Q },
  'activity/live': { GET: 'view', POST: 'view', resource: ROOM_Q, allowExternal: true },
  'qa': { GET: 'view', POST: 'comment', resource: ROOM_Q, allowExternal: true },
  'tasks': { GET: 'view', POST: 'edit', resource: ROOM_Q },
  'workflows': { GET: 'view', POST: 'edit', resource: ROOM_Q },
  'user-groups': { GET: 'admin', POST: 'admin', resource: ROOM_Q },
  'signatures': { GET: 'view', POST: 'view', resource: ROOM_Q, allowExternal: true },
  'external-users': { GET: 'admin', POST: 'admin', resource: ROOM_Q },
  'metadata-templates': { GET: 'view', POST: 'admin', resource: ROOM_Q },

  // ── Secondary entities: permission is on the owning room ───────────────
  'comments/[id]': { PUT: 'comment', DELETE: 'comment', roomOf: ['dataroom_comments', 'id'] },
  'qa/[id]': { GET: 'view', PUT: 'comment', DELETE: 'admin', roomOf: ['dataroom_qa', 'id'], allowExternal: true },
  'tasks/[id]': { GET: 'view', PUT: 'edit', DELETE: 'edit', roomOf: ['dataroom_tasks', 'id'] },
  'workflows/[id]': { GET: 'view', PUT: 'edit', DELETE: 'edit', roomOf: ['dataroom_workflows', 'id'] },
  'workflows/[id]/approve': { POST: 'admin', roomOf: ['dataroom_workflows', 'id'] },
  'workflows/[id]/reject': { POST: 'admin', roomOf: ['dataroom_workflows', 'id'] },
  'user-groups/[id]': { GET: 'admin', PUT: 'admin', DELETE: 'admin', roomOf: ['dataroom_user_groups', 'id'] },
  'metadata-templates/[id]': { GET: 'view', PUT: 'admin', DELETE: 'admin', roomOf: ['dataroom_metadata_templates', 'id'] },
  'external-users/[id]': { GET: 'admin', PUT: 'admin', DELETE: 'admin', roomOf: ['dataroom_external_users', 'id'] },
  'share/[id]': { PUT: 'admin', DELETE: 'admin', roomOf: ['dataroom_shares', 'id'] },

  // ── Permission administration — always `admin` on the target ───────────
  'permissions': { GET: 'admin', POST: 'admin', DELETE: 'admin', bodyResource: true },
  'permissions/[id]/expiry': { PUT: 'admin', roomOf: ['dataroom_permissions', 'id'] },
  'permissions/approve': { POST: 'admin', bodyResource: true },
  'permissions/ip-whitelist': { GET: 'admin', PUT: 'admin', POST: 'admin', DELETE: 'admin', bodyResource: true },

  // ── Body-scoped mutations ──────────────────────────────────────────────
  'bulk': { POST: 'edit', bodyRoom: true },
  'documents/move': { POST: 'edit', bodyRoom: true },

  // ── Self-scoping exceptions (see check-dataroom-route-guards.cjs) ──────
  // rooms GET is an inherently cross-room list; POST is gated on role since
  // there is no room yet to hold a grant.
  'rooms': { GET: 'SELF', POST: 'ADMIN_ROLE' },
  // Multipart: roomId is inside the body and re-parsing a 100MB upload to
  // resolve it is not acceptable. Checked inline instead.
  'documents/bulk-upload': { POST: 'SELF' },
  // Requesting access is done BY someone who has none, so it cannot require a
  // grant on the target. Validated inline.
  'permissions/request': { POST: 'SELF', allowExternal: true },
  'activity/heartbeat': { POST: 'SELF', allowExternal: true },
  // Not a data room resource — lists org users for permission pickers.
  'org-users': { GET: 'ADMIN_ROLE' },

  // ── Public by design: no wrapper ───────────────────────────────────────
  'share/validate': { SKIP: 'public share-token validation' },
  'external-auth/login': { SKIP: 'public' },
  'external-auth/logout': { SKIP: 'public' },
  'external-auth/me': { SKIP: 'public' },
  'external-auth/register': { SKIP: 'public' },
  'external-auth/send-verification': { SKIP: 'public' },
  'external-auth/verify-email': { SKIP: 'public' },
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function relDir(file) {
  return path
    .relative(ROOT, path.dirname(file))
    .split(path.sep)
    .join('/');
}

// From src/app/api/dataroom/<a>/<b>/route.js the lib directory is
// (depth below ROOT) + 3 hops up — dataroom, api, app — then src/lib.
function importPrefix(file) {
  const depth = path.relative(ROOT, file).split(path.sep).length + 2;
  return '../'.repeat(depth) + 'lib/dataroom/withDataroomAuth';
}

// Only these are destructured from the wrapper context. `room`, `roomId`,
// `client` and `isAdmin` are deliberately NOT: handlers routinely declare
// their own locals with those names, and destructuring them produces a
// redeclaration SyntaxError. Routes that need them get edited by hand.
const CTX_BINDINGS = ['user', 'db', 'params'];

// Refuse to transform a file that already declares one of the names we bind,
// rather than writing something that cannot parse.
function collidingBindings(src) {
  return CTX_BINDINGS.filter((n) =>
    new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=`).test(src),
  );
}

function buildOptions(cfg, method) {
  const perm = cfg[method];
  const opts = [];

  if (perm === 'SELF') {
    opts.push('selfScoped: true');
  } else if (perm === 'ADMIN_ROLE') {
    opts.push('roles: ADMIN_ROLES');
  } else {
    opts.push(`requires: '${perm}'`);
    if (cfg.resource) {
      const r = cfg.resource;
      opts.push(
        `resource: { type: '${r.type}', ${r.param ? `param: '${r.param}'` : `query: '${r.query}'`} }`,
      );
    } else if (cfg.roomOf) {
      opts.push(`resolve: roomOf('${cfg.roomOf[0]}', '${cfg.roomOf[1]}')`);
    } else if (cfg.bodyRoom) {
      opts.push("resolve: resourceFromBody(null, 'roomId', 'room')");
    } else if (cfg.bodyResource) {
      opts.push("resolve: resourceFromBody('resourceType', 'resourceId')");
    }
  }

  if (cfg.allowExternal) opts.push('allowExternal: true');
  return opts;
}

const skipped = [];
const converted = [];
const failed = [];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.js') out.push(p);
  }
  return out;
}

for (const file of walk(ROOT)) {
  const key = relDir(file);
  let src = fs.readFileSync(file, 'utf8');

  if (src.includes('withDataroomAuth')) {
    skipped.push(`${key}: already migrated by hand`);
    continue;
  }

  const cfg = ROUTES[key];
  if (!cfg) {
    failed.push(`${key}: no entry in ROUTES`);
    continue;
  }
  if (cfg.SKIP) {
    skipped.push(`${key}: ${cfg.SKIP}`);
    continue;
  }

  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const nl = (s) => s.split('\n').join(eol);
  let touched = false;

  // The helpers we are about to delete declare `user`; ignore those two lines
  // when checking for collisions, since they disappear in this pass.
  const withoutHelpers = src
    .replace(/async function getUserFromToken\(request\) \{[\s\S]*?\r?\n\}/, '')
    .replace(/\s*const user = await getUserFromToken\(request\);/g, '')
    // These are removed by step 3 below, so they are not real collisions.
    .replace(/\s*const client = await clientPromise;/g, '')
    .replace(/\s*const db = client\.db\('resources'\);/g, '');

  const collisions = collidingBindings(withoutHelpers);
  if (collisions.length) {
    failed.push(`${key}: declares local ${collisions.join(', ')} — would collide with ctx binding`);
    continue;
  }

  // 1. Strip the copy-pasted helpers.
  src = src.replace(
    /async function getUserFromToken\(request\) \{[\s\S]*?\r?\n\}\r?\n\r?\n?/,
    () => {
      touched = true;
      return '';
    },
  );
  src = src.replace(/function isAdminLike\(user\) \{[\s\S]*?\r?\n\}\r?\n\r?\n?/, '');

  // 2. Convert each exported handler.
  const needed = new Set();
  let fileFailed = false;
  for (const method of METHODS) {
    if (!cfg[method]) continue;

    // The guard clauses appear both as one-liners and as multi-line blocks,
    // so each optional group accepts either form.
    const guard = (cond) =>
      `(\\s*if \\(${cond}\\)\\s*\\{[\\s\\S]{0,200}?\\r?\\n\\s*\\}\\r?\\n|\\s*if \\(${cond}\\)[^\\n]*\\r?\\n)?`;

    const re = new RegExp(
      `export async function ${method}\\(request(?:,\\s*\\{\\s*params\\s*\\})?\\)\\s*\\{\\r?\\n\\s*try \\{\\r?\\n` +
        `(\\s*const user = await getUserFromToken\\(request\\);\\r?\\n)?` +
        guard('!user') +
        guard('!isAdminLike\\(user\\)'),
    );

    if (!re.test(src)) {
      // Atomic per file: the helpers are deleted for the whole file, so a
      // partially converted file would leave the remaining handlers calling
      // a function that no longer exists — a silent ReferenceError at
      // runtime rather than a build failure. Abandon the file instead.
      failed.push(`${key}:${method}: handler shape not recognised`);
      fileFailed = true;
      break;
    }

    const opts = buildOptions(cfg, method);
    if (opts.some((o) => o.includes('roomOf('))) needed.add('roomOf');
    if (opts.some((o) => o.includes('resourceFromBody('))) needed.add('resourceFromBody');
    if (opts.some((o) => o.includes('ADMIN_ROLES'))) needed.add('ADMIN_ROLES');

    src = src.replace(
      re,
      nl(`export const ${method} = withDataroomAuth(\n  async (request, { ${CTX_BINDINGS.join(', ')} }) => {\n`),
    );
    touched = true;

    // Close: the wrapper owns the try/catch, so drop the handler's own.
    const closeRe = new RegExp(
      `\\r?\\n\\s*\\} catch \\(error\\) \\{\\r?\\n\\s*console\\.error\\('${method} [^']*',\\s*error\\);\\r?\\n\\s*return NextResponse\\.json\\(\\{ error: '[^']*' \\}, \\{ status: 500 \\}\\);\\r?\\n\\s*\\}\\r?\\n\\}`,
    );
    if (closeRe.test(src)) {
      src = src.replace(
        closeRe,
        nl(`\n  },\n  {\n${opts.map((o) => `    ${o},`).join('\n')}\n  },\n);`),
      );
    } else {
      failed.push(`${key}:${method}: could not find closing try/catch`);
      fileFailed = true;
      break;
    }
  }

  if (fileFailed || !touched) continue;

  // Post-condition. The guard clauses are not always adjacent to `try {` —
  // some handlers read query params first — so the opening regex can match
  // while leaving a call to the helper we just deleted further down the body.
  // Checking the result catches every such shape, where tightening the regex
  // would only catch the ones anticipated.
  if (/getUserFromToken\(request\)|isAdminLike\(user\)/.test(src)) {
    failed.push(`${key}: helper still referenced after transform — converting by hand`);
    continue;
  }

  // 3. Drop the now-duplicated connection lines (ctx supplies db/client).
  src = src.replace(
    /\s*const client = await clientPromise;\r?\n\s*const db = client\.db\('resources'\);\r?\n/g,
    eol,
  );
  src = src.replace(/^import clientPromise from '[^']*';\r?\n/m, '');

  // 4. Add the wrapper import.
  const imports = ['withDataroomAuth', ...[...needed].sort()].join(', ');
  src = src.replace(
    /^(import .*\r?\n)(?![\s\S]*^import )/m,
    (m) => `${m}import { ${imports} } from '${importPrefix(file)}';${eol}`,
  );

  if (!DRY) fs.writeFileSync(file, src);
  converted.push(key);
}

console.log(`converted: ${converted.length}`);
for (const c of converted) console.log(`  ok       ${c}`);
console.log(`\nskipped: ${skipped.length}`);
for (const s of skipped) console.log(`  skip     ${s}`);
console.log(`\nneeds manual work: ${failed.length}`);
for (const f of failed) console.log(`  MANUAL   ${f}`);
