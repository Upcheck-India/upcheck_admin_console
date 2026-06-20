import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function POST(request) {
  try {
    const { privacy, notificationsEnabled } = await request.json();

    const updateFields = {};

    if (privacy !== undefined) {
      const validPrivacies = ['none', 'teammates', 'admins', 'everyone'];
      if (!validPrivacies.includes(privacy)) {
        return NextResponse.json({ error: 'Invalid privacy setting' }, { status: 400 });
      }
      updateFields.messagingPrivacy = privacy;
    }

    if (notificationsEnabled !== undefined) {
      updateFields.messageNotificationsEnabled = !!notificationsEnabled;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    
    const result = await db.collection('admin_users').updateOne(
      { sessionToken: token },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...updateFields });
  } catch (err) {
    console.error('Privacy update error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
