// src/lib/oauth/audit.js
// Append-only audit trail for the OAuth service. Every meaningful event —
// client register/verify/suspend/delete, secret rotation, consent grant/deny,
// token issue/refresh/revoke, and (sampled) data access — writes one immutable
// record to `oauth_audit_log`. Records are never updated or deleted. Audit
// writes are best-effort: a failure is logged but never aborts the operation.

/** Build the actor sub-document from an authenticated admin user. */
export function actorFromUser(user) {
  if (!user) return null;
  return {
    id: user?._id?.toString?.() || user?.id || null,
    email: user?.email || null,
    username: user?.username || null,
    role: user?.role || null,
  };
}

/**
 * Write one immutable audit record.
 * @param {import('mongodb').Db} db
 * @param {object} entry
 * @param {string}  entry.action    e.g. 'client.register', 'token.issue', 'grant.revoke', 'data.read'
 * @param {string} [entry.clientId] the OAuth client involved, when applicable
 * @param {object} [entry.actor]    from actorFromUser() (admin actions) — null for client/bearer actions
 * @param {object} [entry.meta]     extra context (scopes, ip, endpoint, reason…)
 * @param {boolean}[entry.ok]       outcome flag (default true)
 */
export async function recordOAuthAudit(db, entry) {
  const doc = {
    action: entry.action,
    clientId: entry.clientId != null ? String(entry.clientId) : null,
    actor: entry.actor || null,
    ok: entry.ok !== false,
    ip: entry.ip || null,
    meta: entry.meta ?? null,
    at: new Date(),
  };
  try {
    await db.collection('oauth_audit_log').insertOne(doc);
  } catch (e) {
    console.error('oauth audit write failed', entry.action, e);
  }
}

/**
 * Best-effort client IP from standard proxy headers (Vercel sets
 * x-forwarded-for). Never trusted for authz — for the audit log only.
 */
export function clientIpFrom(request) {
  try {
    const xff = request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim().slice(0, 64);
    return request.headers.get('x-real-ip')?.slice(0, 64) || null;
  } catch {
    return null;
  }
}
