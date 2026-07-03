// Shared group-chat admin permission helpers. A group can have multiple
// admins (unlike a team's single `lead` field) — the creator is always
// implicitly an admin even if somehow missing from the `admins` array
// (e.g. legacy groups created before this field existed).
export function isGroupAdmin(group, userId) {
  if (!group || !userId) return false;
  const idStr = userId.toString();
  if (group.createdBy?.toString() === idStr) return true;
  return (group.admins || []).some(a => a.toString() === idStr);
}

export function isPlatformAdmin(user) {
  return user?.role === 'Admin' || user?.role === 'Console admin';
}

export function canManageGroup(group, user) {
  return isGroupAdmin(group, user._id) || isPlatformAdmin(user);
}
