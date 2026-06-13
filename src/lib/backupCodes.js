// Backup (recovery) codes for the admin console.
//
// Codes are single-use, high-entropy strings shown to the user exactly once at
// generation time. Only their hashes are stored, so a database leak does not
// expose usable codes. Verification normalises user input (case / separators)
// before hashing so the codes are forgiving to type.

import crypto from 'crypto';

// Crockford-style base32 alphabet with ambiguous characters (I, L, O, U)
// removed to make codes easier to read and transcribe.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP_LENGTH = 5;
const GROUPS = 2; // -> 10 significant chars, formatted as XXXXX-XXXXX
export const BACKUP_CODE_COUNT = 10;

function randomCode() {
  const chars = [];
  const bytes = crypto.randomBytes(GROUP_LENGTH * GROUPS);
  for (let i = 0; i < GROUP_LENGTH * GROUPS; i++) {
    chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
  }
  const groups = [];
  for (let g = 0; g < GROUPS; g++) {
    groups.push(chars.slice(g * GROUP_LENGTH, (g + 1) * GROUP_LENGTH).join(''));
  }
  return groups.join('-');
}

// Strip formatting and upper-case so "abcde-fghjk" matches "ABCDEFGHJK".
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');
}

// Returns { plaintext: string[], records: object[] }. `plaintext` is shown to
// the user once; `records` (hashes only) are what gets stored.
export function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const plaintext = [];
  const seen = new Set();
  while (plaintext.length < count) {
    const code = randomCode();
    if (seen.has(code)) continue;
    seen.add(code);
    plaintext.push(code);
  }
  const createdAt = new Date();
  const records = plaintext.map(code => ({
    hash: hashCode(code),
    used: false,
    usedAt: null,
    createdAt,
  }));
  return { plaintext, records };
}
