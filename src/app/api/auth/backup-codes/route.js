// Backup-code management routes.
//
// GET    — returns status (count, remaining) — no re-auth needed
// POST   — (re)generates a full new set of codes — REQUIRES REAUTH
// DELETE — disables all backup codes — REQUIRES REAUTH

import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { generateBackupCodes, BACKUP_CODE_COUNT } from '../../../../lib/backupCodes';
import { requireReauth, revokeReauth } from '../../../../lib/reauth';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function getSessionUser(projection) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return { error: json({ error: 'Unauthorized' }, 401) };
  const client = await clientPromise;
  const db = client.db('resources');
  const user = await db.collection('admin_users').findOne({ sessionToken: token }, { projection });
  if (!user) return { error: json({ error: 'Unauthorized' }, 401) };
  return { user, db };
}

// Status of the current user's backup codes (never returns the codes themselves).
export async function GET() {
  try {
    const { user, error } = await getSessionUser({ backupCodes: 1, backupCodesGeneratedAt: 1 });
    if (error) return error;

    const codes = Array.isArray(user.backupCodes) ? user.backupCodes : [];
    const remaining = codes.filter(c => !c.used).length;

    return json({
      success: true,
      generated: codes.length > 0,
      total: codes.length,
      remaining,
      generatedAt: user.backupCodesGeneratedAt || null,
    });
  } catch (error) {
    console.error('Error reading backup codes status:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}

// (Re)generate a fresh set of backup codes — requires recent re-authentication.
export async function POST() {
  try {
    const { user, db, error } = await requireReauth();
    if (error) return error;

    const { plaintext, records } = generateBackupCodes(BACKUP_CODE_COUNT);
    const generatedAt = new Date();

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: { backupCodes: records, backupCodesGeneratedAt: generatedAt } }
    );

    // Consume the re-auth window so the user must re-authenticate before
    // the next sensitive action.
    await revokeReauth(user._id);

    return json({
      success: true,
      codes: plaintext,
      total: plaintext.length,
      generatedAt,
      message: 'Store these codes somewhere safe. They will not be shown again.',
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}

// Disable backup codes entirely — requires recent re-authentication.
export async function DELETE() {
  try {
    const { user, db, error } = await requireReauth();
    if (error) return error;

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $unset: { backupCodes: '', backupCodesGeneratedAt: '' } }
    );

    await revokeReauth(user._id);

    return json({ success: true, message: 'Backup codes disabled.' });
  } catch (error) {
    console.error('Error deleting backup codes:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
