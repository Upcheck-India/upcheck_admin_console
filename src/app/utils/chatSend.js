// Shared "send a message to any chat type" helper, used by ForwardModal
// (and available to any page that needs to post into a DM/team/group given
// just a `target` descriptor) so forwarding logic lives in one place.
export async function sendToTarget(target, { body, mediaUrl, replyToId } = {}) {
  let url;
  let payload;

  if (target.type === 'dm') {
    url = '/api/chat/send';
    payload = { conversationId: target.conversationId, body, mediaUrl, replyToId, isForwarded: true };
  } else if (target.type === 'team') {
    url = '/api/team-chat/messages';
    payload = { teamId: target.teamId, body, mediaUrl, replyToId, isForwarded: true };
  } else if (target.type === 'group') {
    url = `/api/group-chats/${target.groupId}/messages`;
    payload = { body, mediaUrl, replyToId, isForwarded: true };
  } else {
    throw new Error('Unknown forward target type');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send message');
  }

  return res.json();
}
