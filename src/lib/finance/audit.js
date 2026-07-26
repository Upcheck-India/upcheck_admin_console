// src/lib/finance/audit.js
// Append-only audit trail for finance mutations. Every create/update/delete/
// money-move writes one immutable record to `finance_audit_log`. Records are
// never updated or deleted. When a session is supplied the audit write joins
// the same transaction as the mutation, so the log can never disagree with the
// data. Audit writes are best-effort: a failure is logged but never aborts the
// business operation (except inside a transaction, where the caller decides).

/** Build the actor sub-document from an authenticated finance user. */
export function actorFromUser(user) {
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
 * @param {string} entry.action    e.g. 'fund.create', 'account.delete', 'transfer.post'
 * @param {string} entry.collection target collection name
 * @param {string|null} [entry.documentId]
 * @param {object} entry.actor     from actorFromUser()
 * @param {object} [entry.before]  prior document state (for updates/deletes)
 * @param {object} [entry.after]   new document state (for creates/updates)
 * @param {object} [entry.meta]    extra context (opId, amounts, reason, ip…)
 * @param {import('mongodb').ClientSession|null} [session]
 */
export async function recordFinanceAudit(db, entry, session = null) {
  const doc = {
    action: entry.action,
    collection: entry.collection,
    documentId: entry.documentId != null ? String(entry.documentId) : null,
    actor: entry.actor || null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    meta: entry.meta ?? null,
    at: new Date(),
  };
  try {
    await db.collection('finance_audit_log').insertOne(doc, session ? { session } : undefined);
  } catch (e) {
    // Inside a transaction we must surface the failure so the whole op rolls
    // back (audit and data stay consistent). Outside one, never break the op.
    if (session) throw e;
    console.error('finance audit write failed', entry.action, e);
  }
}
