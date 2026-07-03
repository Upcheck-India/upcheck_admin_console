import { getUpcomingMeetings, getTodayMeetings, getMeetingById, formatMeetingTime } from './queries.js';

function formatMeetingLine(meeting, index) {
  const joinUrl = meeting.joinUrl || meeting.zoomMeetingUrl;
  const lines = [
    `${index + 1}. **${meeting.title || 'Untitled meeting'}**`,
    `   📅 ${formatMeetingTime(meeting.startTime)}   ⏱️ ${meeting.duration || 30}m`,
  ];
  if (meeting.host) lines.push(`   👤 Hosted by ${meeting.host}`);
  if (joinUrl) lines.push(`   🔗 ${joinUrl}`);
  return lines.join('\n');
}

function renderMeetingList(title, meetings, emptyMessage) {
  if (meetings.length === 0) return emptyMessage;
  const lines = meetings.map((m, i) => formatMeetingLine(m, i));
  return `**${title}** _(${meetings.length})_\n\n${lines.join('\n\n')}`;
}

async function handleMeetings({ db, currentUser }) {
  const meetings = await getUpcomingMeetings(db, currentUser);
  return renderMeetingList('📅 Your upcoming meetings (next 7 days)', meetings, '✅ No meetings scheduled in the next 7 days.');
}

async function handleToday({ db, currentUser }) {
  const meetings = await getTodayMeetings(db, currentUser);
  return renderMeetingList("📅 Today's meetings", meetings, '✅ No meetings scheduled for today.');
}

async function handleMeetingDetail({ db, currentUser, argsText }) {
  const meetingId = argsText.trim();
  if (!meetingId) {
    return 'Usage: `/meeting <meetingId>` — e.g. `/meeting 6710f2...` (from the id shown when a meeting is created or listed).';
  }
  const meeting = await getMeetingById(db, currentUser, meetingId);
  if (!meeting) {
    return `❓ No meeting found with that id, or you're not a host/participant on it.`;
  }
  const joinUrl = meeting.joinUrl || meeting.zoomMeetingUrl;
  return [
    `📌 **${meeting.title || 'Untitled meeting'}**`,
    `   📅 ${formatMeetingTime(meeting.startTime)}   ⏱️ ${meeting.duration || 30}m`,
    meeting.host ? `   👤 Hosted by ${meeting.host}` : null,
    (meeting.participants || []).length > 0 ? `   👥 ${meeting.participants.length} participant(s)` : null,
    joinUrl ? `   🔗 ${joinUrl}` : null,
    meeting.description ? `\n${meeting.description.slice(0, 400)}` : null,
  ].filter(Boolean).join('\n');
}

async function handleHelp() {
  const lines = meetingsPlugin.commands.map(c => `**${c.usage}**\n   ${c.description}`);
  return `**📅 Meetings — commands**\n\n${lines.join('\n\n')}`;
}

const meetingsPlugin = {
  id: 'meetings',
  name: 'Meetings',
  description: 'Check your upcoming or today’s meetings, and pull up meeting details, right from chat.',
  icon: '📅',
  commands: [
    {
      name: 'meetings',
      usage: '/meetings',
      description: 'List your meetings scheduled in the next 7 days.',
      handler: handleMeetings,
    },
    {
      name: 'today',
      usage: '/today',
      description: "List your meetings scheduled for today.",
      handler: handleToday,
    },
    {
      name: 'meeting',
      usage: '/meeting <meetingId>',
      description: 'Show full details for a specific meeting by id (only if you host it or are a participant).',
      handler: handleMeetingDetail,
    },
    {
      name: 'help',
      usage: '/help',
      description: 'List every Meetings command and what it does.',
      handler: handleHelp,
    },
  ],
};

export default meetingsPlugin;
