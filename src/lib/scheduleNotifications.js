import { sendPushNotification } from './pushNotifications';

// Push notifications for claimable time blocks.
//
// There were none. Not "they were broken" — the whole scheduling module never
// called sendPushNotification once. Two consequences, both reported as bugs:
//
//   - In approval mode a request notified nobody, so it sat pending until the
//     owner happened to open the block. The claimant meanwhile saw "awaiting
//     approval" with no idea anyone had been told.
//   - Approving or rejecting notified nobody either, so the person who asked
//     never learned the answer.
//
// Fire-and-forget everywhere: a claim must never fail because a notification
// could not be delivered, which is why every call site drops the promise with
// a .catch and why nothing here throws.

/** How a slot reads in a notification body, in the block's own timezone. */
function describeSlot(block, claim) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: block.timezone || 'UTC',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const start = fmt.format(new Date(claim.startTime));
    const endFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: block.timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${start}–${endFmt.format(new Date(claim.endTime))}`;
  } catch {
    // A malformed date must not cost the notification its body.
    return 'a time slot';
  }
}

/** Someone asked for a slot in an approval-mode block: tell whoever decides. */
export async function notifyClaimRequested(block, claim) {
  const ownerId = block?.ownerId && String(block.ownerId);
  // Approving your own request needs no announcement.
  if (!ownerId || ownerId === String(claim.userId)) return;

  const who = claim.userName || 'Someone';
  await sendPushNotification(
    ownerId,
    `${who} requested time in ${block.title}`,
    `${describeSlot(block, claim)}${claim.note ? ` · ${claim.note}` : ''}`,
    {
      type: 'schedule_claim_request',
      blockId: String(block._id),
      claimId: String(claim._id),
    },
  );
}

/**
 * A claim was withdrawn: replace whatever it already put in the owner's tray.
 *
 * Without this, cancelling a request left the owner holding a notification
 * asking them to approve something that no longer exists. It shares the
 * claim's tag (see collapseKeyForData) so it overwrites rather than stacks,
 * and it is silent because it corrects a notification instead of raising a
 * new concern.
 */
export async function notifyClaimCancelled(block, claim, cancelledBy) {
  const ownerId = block?.ownerId && String(block.ownerId);
  if (!ownerId || ownerId === String(cancelledBy)) return;
  // Only an approval-mode request ever asked the owner for anything.
  if (block.claimMode !== 'approval') return;

  const who = claim.userName || 'Someone';
  await sendPushNotification(
    ownerId,
    `${who} withdrew their request`,
    `${block.title} · ${describeSlot(block, claim)}`,
    {
      type: 'schedule_claim_cancelled',
      blockId: String(block._id),
      claimId: String(claim._id),
    },
    { silent: true },
  );
}

/** A pending claim was approved or rejected: tell whoever asked. */
export async function notifyClaimDecided(block, claim, decision, decidedBy) {
  const holderId = claim?.userId && String(claim.userId);
  // No point telling an owner about their own decision.
  if (!holderId || holderId === String(decidedBy)) return;

  const approved = decision === 'approved';
  await sendPushNotification(
    holderId,
    approved
      ? `Your time in ${block.title} is confirmed`
      : `Your request for ${block.title} was declined`,
    describeSlot(block, claim),
    {
      type: 'schedule_claim_decision',
      decision,
      blockId: String(block._id),
      claimId: String(claim._id),
    },
  );
}
