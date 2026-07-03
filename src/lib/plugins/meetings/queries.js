import { ObjectId } from 'mongodb';

// The `events` collection stores both Date and legacy ISO-string
// `startTime` values (older documents predate a schema tightening) — every
// query here checks both shapes rather than assuming one, matching the
// pattern already used by src/lib/botAgent.js's meeting tools so this
// plugin never disagrees with the AI bot about what "upcoming" means.
function startTimeRange(fromDate, toDate) {
  return {
    $or: [
      { startTime: { $gte: fromDate, $lte: toDate } },
      { startTime: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() } },
    ],
  };
}

function attendeeFilter(userIdStr, email) {
  return { $or: [{ hostId: userIdStr }, { host: email }, { participants: email }] };
}

/** Up to `limit` of `user`'s meetings starting between now and `windowMs`
 * from now, soonest first. */
export async function getUpcomingMeetings(db, user, { windowMs = 7 * 24 * 60 * 60 * 1000, limit = 10 } = {}) {
  const userIdStr = user._id.toString();
  const now = new Date();
  const cutoff = new Date(Date.now() + windowMs);
  const events = await db.collection('events')
    .find({ $and: [attendeeFilter(userIdStr, user.email), startTimeRange(now, cutoff)] })
    .sort({ startTime: 1 })
    .limit(limit)
    .toArray();
  return events;
}

/** `user`'s meetings starting today (local calendar day). */
export async function getTodayMeetings(db, user, { limit = 10 } = {}) {
  const userIdStr = user._id.toString();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const events = await db.collection('events')
    .find({ $and: [attendeeFilter(userIdStr, user.email), startTimeRange(startOfDay, endOfDay)] })
    .sort({ startTime: 1 })
    .limit(limit)
    .toArray();
  return events;
}

/** A single meeting by id, only if `user` is the host or a participant. */
export async function getMeetingById(db, user, meetingId) {
  if (!ObjectId.isValid(meetingId)) return null;
  const event = await db.collection('events').findOne({ _id: new ObjectId(meetingId) });
  if (!event) return null;
  const userIdStr = user._id.toString();
  const isAttendee = event.hostId === userIdStr || event.host === user.email || (event.participants || []).includes(user.email);
  return isAttendee ? event : null;
}

export function formatMeetingTime(startTime) {
  const start = new Date(startTime);
  const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}
