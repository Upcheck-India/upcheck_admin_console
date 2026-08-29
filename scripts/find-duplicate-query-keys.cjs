#!/usr/bin/env node
/**
 * Finds duplicate keys inside the same JS object literal.
 *
 * A duplicate key is legal JavaScript — the last one silently wins — which
 * makes it invisible to the type checker and easy to miss in review. Inside a
 * Mongo query object it is a security bug: the discarded clause is usually the
 * one narrowing the query to the current user.
 *
 * See src/lib/dataroom/permission-checker.js, where a second `$or` overwrote
 * the identity clause and made every document readable by every account.
 *
 * Usage: node scripts/find-duplicate-query-keys.cjs [dir]   (default: src)
 * Exits non-zero when anything is found, so it can gate CI.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'src';
const KEY = /^\s*(\$?[A-Za-z_][\w$]*)\s*:/;
const BACKSLASH = '\\';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.next') walk(p, out);
    } else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// Track a stack of object-literal scopes: `{` pushes, `}` pops. A key seen
// twice in the same scope is a duplicate. Strings, template literals and
// comments are skipped so their braces and colons don't corrupt the depth.
function scan(src, file) {
  const findings = [];
  const stack = [new Map()];
  let line = 1;
  // Last significant (non-whitespace) character, tracked incrementally.
  // Slicing the source backwards on every character is O(n^2) and stalls
  // on large files.
  let prev = '';

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (c === '\n') { line++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') continue;

    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      line++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i++;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === BACKSLASH) i++;
        else if (src[i] === '\n') line++;
        i++;
      }
      prev = quote;
      continue;
    }

    if (c === '{') { stack.push(new Map()); prev = c; continue; }
    if (c === '}') { if (stack.length > 1) stack.pop(); prev = c; continue; }

    // A key can only begin right after `{` or `,`.
    if (prev !== '{' && prev !== ',') { prev = c; continue; }

    const m = KEY.exec(src.slice(i, i + 80));
    if (!m) { prev = c; continue; }

    const key = m[1];
    const scope = stack[stack.length - 1];
    if (scope.has(key)) {
      findings.push({ file, key, first: scope.get(key), dup: line });
    } else {
      scope.set(key, line);
    }
    i += m[0].length - 1;
    prev = ':';
  }

  return findings;
}

let total = 0;
for (const file of walk(ROOT)) {
  for (const d of scan(fs.readFileSync(file, 'utf8'), file)) {
    console.log(
      `${d.file}:${d.dup}  duplicate key "${d.key}" ` +
        `(first defined at line ${d.first}) — the later one silently wins`,
    );
    total++;
  }
}

console.log(
  total === 0
    ? '\nNo duplicate object-literal keys found.'
    : `\n${total} duplicate key(s) found.`,
);
process.exit(total === 0 ? 0 : 1);
