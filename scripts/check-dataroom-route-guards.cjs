#!/usr/bin/env node
/**
 * Asserts that every exported handler under src/app/api/dataroom is wrapped in
 * withDataroomAuth.
 *
 * The module previously drifted to 55 of 60 routes with no permission check at
 * all, because each route hand-rolled its own auth and nothing could see the
 * gap. This makes that gap a failing check rather than an audit finding.
 *
 * Usage:  node scripts/check-dataroom-route-guards.cjs
 * Exits non-zero if any handler is unwrapped.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join('src', 'app', 'api', 'dataroom');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.js' || e.name === 'route.ts') out.push(p);
  }
  return out;
}

const unwrapped = [];
const wrapped = [];
const selfScoped = [];
let handlerCount = 0;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');

  // `selfScoped: true` is the deliberate opt-out for the handful of endpoints
  // that filter their own result set (cross-room lists) or cannot resolve a
  // resource cheaply (multipart uploads whose roomId is in the body). It is
  // listed rather than merely permitted: the module previously drifted to 55
  // unguarded routes precisely because nothing counted the exceptions.
  if (/selfScoped:\s*true/.test(src)) selfScoped.push(file);

  for (const method of METHODS) {
    // `export const GET = withDataroomAuth(...)`  → guarded
    // `export async function GET(...)`            → not guarded
    const constForm = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*([A-Za-z_$][\\w$]*)`);
    const fnForm = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\s*\\(`);

    const asConst = constForm.exec(src);
    const asFn = fnForm.test(src);

    if (!asConst && !asFn) continue;
    handlerCount++;

    if (asConst && asConst[1] === 'withDataroomAuth') {
      wrapped.push(`${file}:${method}`);
    } else {
      unwrapped.push(`${file}:${method}`);
    }
  }
}

for (const u of unwrapped) console.log(`UNGUARDED  ${u}`);

if (selfScoped.length) {
  console.log('\nselfScoped (self-filtering, reviewed exceptions):');
  for (const s of selfScoped) console.log(`  ${s}`);
}

console.log(
  `\n${wrapped.length}/${handlerCount} handler(s) guarded by withDataroomAuth.` +
    (unwrapped.length ? `  ${unwrapped.length} remaining.` : '  All guarded.') +
    `  ${selfScoped.length} file(s) self-scoped.`,
);

process.exit(unwrapped.length === 0 ? 0 : 1);
