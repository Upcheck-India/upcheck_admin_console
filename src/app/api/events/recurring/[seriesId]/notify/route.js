import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { scheduleJob } from '../../../../../../lib/scheduler';
import { ObjectId } from 'mongodb';

// Helper function to get user from token
async function getUserFromToken(token) {
    if (!token) return null;

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne(
        { sessionToken: token },
        {
            projection: {
                _id: 1,
                email: 1,
                name: 1,
                role: 1,
            }
        }
    );
    return user;
}

// POST /api/events/recurring/[seriesId]/notify - Send series notification
export async function POST(request, { params }) {
  try {
    const { seriesId } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(seriesId)) {
      return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Find the series to check ownership
    const series = await db.collection('recurring_series').findOne({ 
      _id: new ObjectId(seriesId),
      hostId: user._id.toString()
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    if (!series.participants || series.participants.length === 0) {
      return NextResponse.json({ 
        error: 'No participants to notify' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { 
      force = false, // Force send even if already sent
      customMessage = null // Optional custom message to include
    } = body;

    // Check if notification was already sent (unless forced)
    if (!force && series.seriesNotification?.sent) {
      return NextResponse.json({ 
        error: 'Series notification already sent. Use force=true to resend.' 
      }, { status: 400 });
    }

    // Schedule the series notification job
    const job = await scheduleJob('send_series_notification', {
      seriesId: seriesId,
      customMessage,
      isResend: force && series.seriesNotification?.sent
    }, new Date());

    // Update the series to mark notification as sent (or being sent)
    await db.collection('recurring_series').updateOne(
      { _id: new ObjectId(seriesId) },
      { 
        $set: { 
          'seriesNotification.sent': true,
          'seriesNotification.sentAt': new Date(),
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ 
      message: 'Series notification scheduled successfully',
      jobId: job._id,
      recipients: series.participants.length
    });

  } catch (error) {
    console.error('Error scheduling series notification:', error);
    return NextResponse.json({ error: 'Failed to schedule series notification' }, { status: 500 });
  }
}