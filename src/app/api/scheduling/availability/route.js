import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { getUserFromToken } from '../../../../lib/eventAuthHelper';
import { defaultAvailability, defaultWeeklyHours, WEEKDAYS } from '../../../../lib/scheduling';

async function authed(request) {
  const token = request.cookies.get('admin_token')?.value;
  return getUserFromToken(token);
}

// GET /api/scheduling/availability — current owner's weekly schedule
export async function GET(request) {
  try {
    const user = await authed(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await db.collection('booking_availability').findOne({ ownerEmail: user.email });

    return NextResponse.json({
      availability: doc
        ? { timezone: doc.timezone, weeklyHours: doc.weeklyHours }
        : defaultAvailability(),
    });
  } catch (e) {
    console.error('availability GET', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function sanitizeWeeklyHours(input) {
  const fallback = defaultWeeklyHours();
  if (!Array.isArray(input)) return fallback;
  return WEEKDAYS.map((_, day) => {
    const r = input.find((x) => Number(x?.day) === day) || {};
    const start = /^\d{1,2}:\d{2}$/.test(r.start) ? r.start : '09:00';
    const end = /^\d{1,2}:\d{2}$/.test(r.end) ? r.end : '17:00';
    return { day, enabled: !!r.enabled, start, end };
  });
}

// PUT /api/scheduling/availability — upsert the owner's schedule
export async function PUT(request) {
  try {
    const user = await authed(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const timezone = String(body.timezone || 'UTC');
    // Validate the timezone is recognized by Intl; fall back to UTC.
    let tz = 'UTC';
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
      tz = timezone;
    } catch { tz = 'UTC'; }

    const weeklyHours = sanitizeWeeklyHours(body.weeklyHours);

    // Reject inverted ranges on enabled days.
    for (const r of weeklyHours) {
      if (r.enabled) {
        const [sh, sm] = r.start.split(':').map(Number);
        const [eh, em] = r.end.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) {
          return NextResponse.json(
            { error: `${WEEKDAYS[r.day]}: end time must be after start time` },
            { status: 400 }
          );
        }
      }
    }

    const client = await clientPromise;
    const db = client.db('resources');
    await db.collection('booking_availability').updateOne(
      { ownerEmail: user.email },
      {
        $set: { ownerEmail: user.email, timezone: tz, weeklyHours, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ availability: { timezone: tz, weeklyHours } });
  } catch (e) {
    console.error('availability PUT', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
