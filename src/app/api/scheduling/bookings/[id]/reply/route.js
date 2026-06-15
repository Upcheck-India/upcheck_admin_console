import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../../lib/eventAuthHelper';
import { sendEmail, EMAIL_TYPES } from '../../../../../../lib/emailService';

export async function POST(request, { params }) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('resources');
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
    if (!booking || booking.ownerEmail !== user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const formattedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="margin:0;background:#F5F8FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1A222B;">
        <div style="max-width:560px;margin:0 auto;padding:24px;">
          <div style="background:linear-gradient(135deg,#0B6DC7,#00CDE8);border-radius:16px 16px 0 0;padding:24px;color:#fff;">
            <div style="font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.85;">Upcheck Scheduling Reply</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">Regarding: ${booking.eventTypeTitle}</div>
          </div>
          <div style="background:#fff;border:1px solid #E0E8EC;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
            <div style="font-size:14px;color:#1A222B;line-height:1.6;white-space:pre-wrap;">${message}</div>
            
            <div style="margin-top:24px;padding-top:16px;border-t:1px solid #E5E7EB;font-size:12px;color:#7A909F;">
              <strong>Meeting details:</strong><br>
              Event: ${booking.eventTypeTitle}<br>
              Time: ${new Date(booking.startTime).toLocaleString()}<br>
              Organizer: ${booking.ownerName || user.username}
            </div>
          </div>
          <div style="text-align:center;color:#7A909F;font-size:12px;margin-top:16px;">Sent via Upcheck Scheduling Console</div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: booking.inviteeEmail,
      subject: subject,
      html: formattedHtml,
      text: message,
      type: EMAIL_TYPES.CUSTOM,
      replyTo: { email: user.email, name: user.username }
    });

    await db.collection('bookings').updateOne(
      { _id: new ObjectId(id) },
      { $set: { repliedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('reply POST', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
