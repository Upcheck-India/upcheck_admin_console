import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { createZoomMeeting } from '../../../lib/zoom';
import { sendEmail } from '../../../lib/email';

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


// GET /api/events
export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");

    const events = await db.collection('events').find({}).sort({ startTime: 1 }).toArray();

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST /api/events
export async function POST(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const { title, description, participants, startTime, duration, sendNotification, zoomSettings } = await request.json();

    if (!title || !description || !startTime || !duration) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const eventData = {
        title,
        description,
        host: user.email,
        hostId: user._id.toString(),
        duration: parseInt(duration, 10),
        participants: participants || [],
        startTime: new Date(startTime),
        endTime: new Date(new Date(startTime).getTime() + parseInt(duration, 10) * 60000),
        sendNotification: !!sendNotification,
        createdAt: new Date(),
        zoomSettings,
    };

    const zoomMeeting = await createZoomMeeting(eventData);

    eventData.zoomMeetingUrl = zoomMeeting.join_url;
    eventData.zoomMeetingId = zoomMeeting.id;

    const result = await db.collection('events').insertOne(eventData);

    if (eventData.sendNotification && eventData.participants.length > 0) {
      const subject = `You're invited to: ${eventData.title}`;
      const emailOptions = {
        host: eventData.host,
        event: {
          title: eventData.title,
          startTime: eventData.startTime,
          duration: eventData.duration,
          zoomMeetingUrl: eventData.zoomMeetingUrl,
        },
      };

      for (const participantEmail of eventData.participants) {
        await sendEmail(participantEmail, subject, emailOptions);
      }
    }

    return NextResponse.json({ ...eventData, _id: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
