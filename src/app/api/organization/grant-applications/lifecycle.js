// Shared grant-application lifecycle rules, used by both the collection route
// and the [id] route. Kept out of route.js files so Next.js route modules only
// export HTTP handlers.
import { FinanceError } from '../../../../lib/finance/tx';
import { capString } from '../../../../lib/finance/auth';

// ---------------------------------------------------------------------------
// Status state machine (remediation task 1.7)
// ---------------------------------------------------------------------------
// Whitelisted statuses. Any value outside this set is rejected on POST/PUT.
export const ALLOWED_STATUSES = [
  'need_to_apply',
  'pending',
  'waiting',
  'granted',
  'pending_transfer',
  'rejected',
];

// Legal transitions, keyed by the CURRENT status. A same-status "no-op" save is
// always allowed (the edit modal re-submits the unchanged status). Forward
// skips from the early states are allowed because users often update the
// tracker after the fact; backward moves are allowed as admin corrections,
// EXCEPT ones that would rewrite settled history:
//   - granted / pending_transfer can never go back to need_to_apply or pending
//   - rejected cannot jump straight to granted — reopen (→ pending/waiting) first
//   - once money has been received into the org (untransferredId set), the
//     application is pinned to 'granted' (enforced in the PUT handler).
export const STATUS_TRANSITIONS = {
  need_to_apply: ['pending', 'waiting', 'granted', 'pending_transfer', 'rejected'],
  pending: ['need_to_apply', 'waiting', 'granted', 'pending_transfer', 'rejected'],
  waiting: ['pending', 'granted', 'pending_transfer', 'rejected'],
  granted: ['pending_transfer', 'waiting', 'rejected'],
  pending_transfer: ['granted', 'waiting', 'rejected'],
  rejected: ['need_to_apply', 'pending', 'waiting'],
};

export function canTransition(from, to) {
  if (from === to) return true; // no-op save
  // Legacy/unknown stored status: allow moving to any whitelisted status so
  // old documents can be repaired through the UI.
  if (!ALLOWED_STATUSES.includes(from)) return ALLOWED_STATUSES.includes(to);
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Unified "money arrived" bookkeeping (remediation task X.2) — ONE source of truth
// ---------------------------------------------------------------------------
// The legacy code carried two overlapping flag systems on each application:
//   - transferred / transferredToFundId / transferredAt
//   - receivedToOrg / untransferredId
// They could disagree. CANONICAL MODEL: `untransferredId` (the link to the
// org_untransferred pool record) is the source of truth for "money arrived and
// was recorded"; `receivedToOrg` is the canonical boolean the UI consumes and
// is written in sync with it. The legacy `transferred` flag is still read
// (isReceivedToOrg tolerates old docs) and mirror-written for backward compat,
// but is never accepted as client input.
export function isReceivedToOrg(doc) {
  return (
    doc?.untransferredId != null ||
    doc?.receivedToOrg === true ||
    doc?.transferred === true
  );
}

// fundingStage values:
//   'none'              – not (yet) funded: need_to_apply / pending / waiting / rejected
//   'awaiting_receipt'  – funder approved, money not yet in the org (status pending_transfer)
//   'granted'           – granted, but not yet pushed into the untransferred pool
//   'received'          – granted AND recorded into the untransferred pool
export function deriveFundingStage(status, received) {
  if (status === 'pending_transfer') return 'awaiting_receipt';
  if (status === 'granted') return received ? 'received' : 'granted';
  return 'none';
}

// ---------------------------------------------------------------------------
// Grant lifecycle depth (task 2.9): attachments, milestones, reminders
// ---------------------------------------------------------------------------
export const MAX_ATTACHMENTS = 20;
export const MAX_MILESTONES = 50;
export const MILESTONE_STATUSES = ['pending', 'done'];
const REMINDER_WINDOW_DAYS = 30;
const REMINDER_CAP = 50;
const DAY_MS = 86400000;
const IST_OFFSET_MIN = 330;

/**
 * Sanitize the attachments array (full-replace semantics). Empty rows are
 * dropped; a non-empty URL must be http(s) so we never render a javascript:
 * link in the UI.
 */
export function sanitizeAttachments(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new FinanceError('attachments must be an array', 400);
  const out = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const name = capString(row.name, 200);
    const url = capString(row.url, 1000);
    if (!name && !url) continue; // blank row from the form
    if (!url) throw new FinanceError('Each attachment needs a URL', 400);
    if (!/^https?:\/\//i.test(url)) {
      throw new FinanceError('Attachment URLs must start with http:// or https://', 400);
    }
    out.push({ name: name || url, url });
    if (out.length > MAX_ATTACHMENTS) {
      throw new FinanceError(`At most ${MAX_ATTACHMENTS} attachments are allowed`, 400);
    }
  }
  return out;
}

/**
 * Validate + sanitize the milestones array (full-replace semantics). `doneAt`
 * is stamped SERVER-SIDE: client-supplied doneAt is ignored; a milestone that
 * transitions to 'done' gets doneAt = now, one already done in the before-image
 * (matched by position) keeps its original doneAt, and reverting to 'pending'
 * clears it.
 */
export function sanitizeMilestones(input, beforeMilestones = [], now = new Date()) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new FinanceError('milestones must be an array', 400);
  if (input.length > MAX_MILESTONES) {
    throw new FinanceError(`At most ${MAX_MILESTONES} milestones are allowed`, 400);
  }
  const before = Array.isArray(beforeMilestones) ? beforeMilestones : [];
  const out = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') throw new FinanceError('Invalid milestone entry', 400);
    const title = capString(row.title, 200);
    if (!title) throw new FinanceError('Each milestone needs a title', 400);
    let dueDate = null;
    if (row.dueDate != null && row.dueDate !== '') {
      const d = new Date(row.dueDate);
      if (Number.isNaN(d.getTime())) throw new FinanceError('Invalid milestone due date', 400);
      dueDate = d;
    }
    const status = row.status === undefined ? 'pending' : row.status;
    if (!MILESTONE_STATUSES.includes(status)) {
      throw new FinanceError("Milestone status must be 'pending' or 'done'", 400);
    }
    const prev = before[out.length];
    let doneAt = null;
    if (status === 'done') {
      doneAt = prev && prev.status === 'done' && prev.doneAt ? new Date(prev.doneAt) : now;
    }
    out.push({ title, dueDate, status, notes: capString(row.notes, 1000), doneAt });
  }
  return out;
}

/** UTC instant of IST midnight "today" — the boundary before which a due date is overdue. */
function istTodayStartUTC(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    IST_OFFSET_MIN * 60000
  );
}

function parseDue(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Read-time deadline reminders (no cron): application deadlines for
 * still-in-flight applications plus pending milestone due dates for
 * non-rejected applications, overdue or due within the next 30 IST days.
 * Sorted by dueDate ascending, capped.
 */
export function buildReminders(applications, now = new Date()) {
  const todayStart = istTodayStartUTC(now);
  const windowEnd = todayStart + (REMINDER_WINDOW_DAYS + 1) * DAY_MS;
  const out = [];
  for (const app of applications || []) {
    const appId = String(app._id);
    if (['need_to_apply', 'pending', 'waiting'].includes(app.status)) {
      const due = parseDue(app.deadline);
      if (due && due.getTime() < windowEnd) {
        out.push({
          applicationId: appId,
          programName: app.programName || '',
          kind: 'application_deadline',
          title: 'Application deadline',
          dueDate: due,
          overdue: due.getTime() < todayStart,
        });
      }
    }
    if (app.status !== 'rejected' && Array.isArray(app.milestones)) {
      for (const m of app.milestones) {
        if (!m || m.status === 'done') continue;
        const due = parseDue(m.dueDate);
        if (due && due.getTime() < windowEnd) {
          out.push({
            applicationId: appId,
            programName: app.programName || '',
            kind: 'milestone',
            title: m.title || 'Milestone',
            dueDate: due,
            overdue: due.getTime() < todayStart,
          });
        }
      }
    }
  }
  out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return out.slice(0, REMINDER_CAP);
}

/** Normalize a stored document to the unified model for API responses. */
export function normalizeApplication(doc, now = new Date()) {
  const received = isReceivedToOrg(doc);
  const milestones = Array.isArray(doc?.milestones) ? doc.milestones : [];
  const todayStart = istTodayStartUTC(now);
  let milestonesPending = 0;
  let milestonesOverdue = 0;
  for (const m of milestones) {
    if (!m || m.status === 'done') continue;
    milestonesPending += 1;
    const due = parseDue(m.dueDate);
    if (due && due.getTime() < todayStart) milestonesOverdue += 1;
  }
  return {
    ...doc,
    attachments: Array.isArray(doc?.attachments) ? doc.attachments : [],
    milestones,
    milestonesPending,
    milestonesOverdue,
    receivedToOrg: received,
    fundingStage: deriveFundingStage(doc?.status, received),
  };
}
