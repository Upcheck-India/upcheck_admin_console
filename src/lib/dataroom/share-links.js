import crypto from 'crypto';
import { ObjectId } from 'mongodb';

/**
 * Share links.
 *
 * A share link used to be a token in a collection that nothing consulted: the
 * authorisation gate knew only about staff sessions and external accounts, so
 * possessing a valid token granted precisely nothing. This module makes a link
 * an identity the gate can accept, with a scope it cannot escape.
 *
 * Two independent questions, deliberately kept apart:
 *
 *   AUDIENCE  — who is allowed through the link at all.
 *   PROTECTION — how much the visitor must prove about who they are.
 *
 * They are orthogonal. "Anyone with the link, but tell me your email" is a
 * real and common combination, and so is "only these three people, and prove
 * it by signing in". Collapsing them into one setting is what produces links
 * that are restricted in the UI and open in fact.
 */

export const AUDIENCES = ['anyone', 'restricted'];

export const PROTECTIONS = [
  'none', // no identification at all
  'collect_email', // ask for an email, believe the answer
  'verify_email', // ask for an email, prove it with an emailed code
  'external_account', // require a signed-in registered external user
];

export const SHAREABLE_RESOURCE_TYPES = ['document', 'folder', 'room'];

export const SHARE_COOKIE = 'dataroom_share_session';
export const SHARE_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const VERIFICATION_CODE_MS = 15 * 60 * 1000;

/**
 * Read a share record in the current shape, whatever shape it was written in.
 *
 * Links created before audiences existed carry a single `targetEmail` and
 * nothing else. Treating those as `anyone` would silently widen every link
 * ever issued, so they normalise to a restricted link naming that one address.
 */
export function normalizeShare(share) {
  if (!share) return null;

  const legacyEmail = share.targetEmail ? [String(share.targetEmail).toLowerCase()] : [];

  return {
    ...share,
    audience: AUDIENCES.includes(share.audience)
      ? share.audience
      : legacyEmail.length
        ? 'restricted'
        : 'anyone',
    allowedEmails: (share.allowedEmails || legacyEmail).map((e) => String(e).toLowerCase()),
    allowedRoles: share.allowedRoles || [],
    allowedUserIds: (share.allowedUserIds || []).map(String),
    protection: PROTECTIONS.includes(share.protection)
      ? share.protection
      : legacyEmail.length
        ? 'collect_email'
        : 'none',
    permissions: share.permissions || ['view'],
  };
}

/** Why a link cannot be used right now, or null if it can. */
export function linkUnusableReason(share) {
  if (!share) return 'Invalid share link';
  if (share.revokedAt) return 'This share link has been revoked';
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return 'This share link has expired';
  }
  if (share.maxAccesses && (share.accessCount || 0) >= share.maxAccesses) {
    return 'This share link has reached its access limit';
  }
  return null;
}

/**
 * Is this visitor in the link's audience?
 *
 * `visitor` is { email, user }, where `user` is the signed-in org account if
 * there is one. Role and member rules can only be satisfied by a signed-in org
 * account — an email address is a claim, not a membership.
 */
export function audienceAdmits(share, { email, user }) {
  if (share.audience === 'anyone') return true;

  const addr = email ? String(email).toLowerCase() : null;
  if (addr && share.allowedEmails.includes(addr)) return true;
  if (!user || user.isExternal) return false;
  if (share.allowedUserIds.includes(user._id?.toString())) return true;
  if (share.allowedRoles.includes(user.role)) return true;
  return false;
}

/** What the visitor must supply before a session can be minted. */
export function requirementFor(share) {
  switch (share.protection) {
    case 'collect_email':
      return { needsEmail: true, needsCode: false, needsExternalAccount: false };
    case 'verify_email':
      return { needsEmail: true, needsCode: true, needsExternalAccount: false };
    case 'external_account':
      return { needsEmail: false, needsCode: false, needsExternalAccount: true };
    default:
      return { needsEmail: false, needsCode: false, needsExternalAccount: false };
  }
}

/**
 * Does this share cover the resource being requested?
 *
 * This is the check that makes a link's scope mean something. Without it a
 * link to one document would authenticate its holder for every request in the
 * room, because the gate would see a valid identity carrying `view` and stop
 * there.
 *
 * Containment, by shared type:
 *   room     — anything whose roomId is the shared room
 *   folder   — the folder itself, its descendants, and documents in any of them
 *   document — that document only
 */
export async function shareCovers(db, share, ref, roomId) {
  if (!ref) return false;
  const sharedId = share.resourceId?.toString();

  if (share.resourceType === 'document') {
    return ref.type === 'document' && ref.id === sharedId;
  }

  if (share.resourceType === 'room') {
    if (ref.type === 'room') return ref.id === sharedId;
    return !!roomId && roomId === sharedId;
  }

  if (share.resourceType === 'folder') {
    if (ref.type === 'room') return false;

    // Folder trees are addressed by a materialised `path`, so descendance is a
    // prefix test rather than a recursive walk.
    const shared = await db
      .collection('dataroom_folders')
      .findOne({ _id: new ObjectId(sharedId) }, { projection: { path: 1, roomId: 1 } });
    if (!shared) return false;

    if (ref.type === 'folder') {
      if (ref.id === sharedId) return true;
      const folder = await db
        .collection('dataroom_folders')
        .findOne({ _id: new ObjectId(ref.id) }, { projection: { path: 1 } });
      return isUnder(folder?.path, shared.path);
    }

    if (ref.type === 'document') {
      const doc = await db
        .collection('dataroom_documents')
        .findOne({ _id: new ObjectId(ref.id) }, { projection: { folderId: 1, folderPath: 1 } });
      if (!doc) return false;
      if (doc.folderId?.toString() === sharedId) return true;
      return isUnder(doc.folderPath, shared.path);
    }
  }

  return false;
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A MongoDB filter restricting a listing to what this share covers — the
 * listing counterpart of shareCovers().
 *
 * List endpoints scope their own results, so they cannot be bounded by the
 * gate's per-resource check. They ask for this instead. Returning a deny-all
 * filter for an unrecognised shape is deliberate: a listing that cannot work
 * out its own bounds must return nothing, not everything.
 */
export async function shareDocumentsFilter(db, share) {
  if (share.resourceType === 'document') {
    return { _id: share.resourceId };
  }
  if (share.resourceType === 'room') {
    return { roomId: share.resourceId };
  }
  if (share.resourceType === 'folder') {
    const folder = await db
      .collection('dataroom_folders')
      .findOne({ _id: share.resourceId }, { projection: { path: 1 } });
    if (!folder) return { _id: { $in: [] } };

    return {
      $or: [
        { folderId: share.resourceId },
        { folderPath: folder.path },
        { folderPath: { $regex: `^${escapeRegex(folder.path.replace(/\/$/, ''))}/` } },
      ],
    };
  }
  return { _id: { $in: [] } };
}

/** The same, for a folder listing. */
export async function shareFoldersFilter(db, share) {
  if (share.resourceType === 'document') {
    // A document link grants nothing over the folder tree it happens to sit in.
    return { _id: { $in: [] } };
  }
  if (share.resourceType === 'room') {
    return { roomId: share.resourceId };
  }
  if (share.resourceType === 'folder') {
    const folder = await db
      .collection('dataroom_folders')
      .findOne({ _id: share.resourceId }, { projection: { path: 1 } });
    if (!folder) return { _id: { $in: [] } };

    return {
      $or: [
        { _id: share.resourceId },
        { path: { $regex: `^${escapeRegex(folder.path.replace(/\/$/, ''))}/` } },
      ],
    };
  }
  return { _id: { $in: [] } };
}

/**
 * Path containment. The separator matters: without it, `/Legal Archive` reads
 * as being inside `/Legal`.
 */
function isUnder(path, ancestorPath) {
  if (!path || !ancestorPath) return false;
  if (path === ancestorPath) return true;
  const prefix = ancestorPath.endsWith('/') ? ancestorPath : `${ancestorPath}/`;
  return path.startsWith(prefix);
}

/** Create a share session and return the cookie value to set. */
export async function mintShareSession(db, share, { email, user, request }) {
  const token = crypto.randomBytes(32).toString('hex');

  await db.collection('dataroom_share_sessions').insertOne({
    token,
    shareId: share._id,
    shareToken: share.shareToken,
    email: email ? String(email).toLowerCase() : null,
    orgUserId: user && !user.isExternal ? user._id.toString() : null,
    externalUserId: user?.isExternal ? user._id.toString() : null,
    userAgent: request?.headers.get('user-agent') || null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SHARE_SESSION_MS),
  });

  await db.collection('dataroom_shares').updateOne(
    { _id: share._id },
    { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } },
  );

  return token;
}

/**
 * Resolve a share-session cookie into the share it belongs to.
 *
 * The share is re-read on every request rather than trusted from the session,
 * so revoking or expiring a link takes effect immediately instead of at the
 * end of a 12-hour session.
 */
export async function resolveShareSession(request, db) {
  const token = request.cookies.get(SHARE_COOKIE)?.value;
  if (!token) return null;

  const session = await db.collection('dataroom_share_sessions').findOne({ token });
  if (!session) return null;
  if (session.expiresAt && new Date() > new Date(session.expiresAt)) return null;

  const share = normalizeShare(
    await db.collection('dataroom_shares').findOne({ _id: session.shareId }),
  );
  if (!share || linkUnusableReason(share)) return null;

  return { session, share };
}

/** Store a one-time code for `verify_email` links. */
export async function issueVerificationCode(db, share, email) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

  await db.collection('dataroom_share_codes').updateOne(
    { shareId: share._id, email: String(email).toLowerCase() },
    {
      $set: {
        // Stored hashed: the codes collection is not a place to keep anything
        // that is directly usable if it leaks.
        codeHash: crypto.createHash('sha256').update(code).digest('hex'),
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_MS),
        attempts: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return code;
}

const MAX_CODE_ATTEMPTS = 5;

/** Check a code, consuming it on success. */
export async function consumeVerificationCode(db, share, email, code) {
  const addr = String(email).toLowerCase();
  const record = await db
    .collection('dataroom_share_codes')
    .findOne({ shareId: share._id, email: addr });

  if (!record) return false;
  if (new Date() > new Date(record.expiresAt)) return false;
  if ((record.attempts || 0) >= MAX_CODE_ATTEMPTS) return false;

  const hash = crypto.createHash('sha256').update(String(code)).digest('hex');
  const ok =
    hash.length === record.codeHash?.length &&
    crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(record.codeHash, 'hex'));

  if (!ok) {
    await db
      .collection('dataroom_share_codes')
      .updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    return false;
  }

  await db.collection('dataroom_share_codes').deleteOne({ _id: record._id });
  return true;
}
