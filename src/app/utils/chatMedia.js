// Shared helper for uploading an image to the existing /api/chat/upload-media
// endpoint (used by DM, team, and group chat — the route itself already
// accepts chatType: 'dm' | 'team' | 'group').
export async function uploadChatImage(file, chatType, chatId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chatType', chatType);
  formData.append('chatId', chatId);

  const res = await fetch('/api/chat/upload-media', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload image');
  }
  return data.mediaUrl;
}

// Extracts the first pasted image file from a clipboard paste event, if any.
export function getPastedImageFile(clipboardEvent) {
  const items = clipboardEvent.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}
