import { NextResponse } from 'next/server';

// Ensure this route is never statically optimized so auth cookies are always read
export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import clientPromise from '../../../lib/mongodb';
import { startJobProcessing } from '../../../lib/jobHandlers.js';

// Initialize job processing system once
let jobSystemInitialized = false;
if (!jobSystemInitialized) {
  try {
    startJobProcessing();
    jobSystemInitialized = true;
    console.log('Job processing system initialized via heartbeat');
  } catch (error) {
    console.error('Failed to initialize job processing system:', error);
  }
}

// POST  /api/heartbeat
// Updates the lastHeartbeat timestamp for the currently authenticated user.
// Auth: requires valid admin_token cookie
function extractAdminToken(req) {
  try {
    const raw = req.cookies?.get?.('admin_token');
    if (raw) return typeof raw === 'string' ? raw : raw.value;
  } catch (_) { /* ignore */ }
  // Fallback to server-side cookies helper
  return cookies().get('admin_token')?.value;
}

async function handleHeartbeat(req) {
  try {
    // First attempt to read from the incoming request cookies (App Router style)
    const token = extractAdminToken(req);
    if (!token) {
      console.warn('Heartbeat: No admin_token cookie found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Heartbeat: token obtained');

    const client = await clientPromise;
    const db = client.db('resources');

    // Ensure a user exists for this session token first
    const user = await db.collection('admin_users').findOne({ sessionToken: token }, { projection: { _id: 1 } });
    if (!user) {
      console.warn('Heartbeat: session token not found in DB');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Heartbeat: user found', user._id.toString());

    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: { lastHeartbeat: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Heartbeat update failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  return handleHeartbeat(req);
}

export async function GET(req) {
  return handleHeartbeat(req);
}
