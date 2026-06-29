import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { encrypt, decrypt } from '../../../../lib/encryption';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser } = auth;

    return NextResponse.json({
      hasKey: !!currentUser.groqApiKey
    });
  } catch (err) {
    console.error('Get bot config error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user: currentUser, db } = auth;

    const { apiKey } = await request.json();

    // If empty key, clear it
    if (!apiKey || !apiKey.trim()) {
      await db.collection('admin_users').updateOne(
        { _id: currentUser._id },
        { $unset: { groqApiKey: "" } }
      );
      return NextResponse.json({ success: true, message: 'API key removed' });
    }

    const trimmedKey = apiKey.trim();

    // Validate key by running a test request to Groq API
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 3
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP error ${response.status}`;
        return NextResponse.json({ error: `Invalid Groq API key: ${errMsg}` }, { status: 400 });
      }
    } catch (fetchErr) {
      console.error('Groq key validation fetch failed:', fetchErr);
      return NextResponse.json({ error: 'Failed to reach Groq API for verification' }, { status: 502 });
    }

    // Encrypt and save key
    const encryptedKey = encrypt(trimmedKey);
    if (!encryptedKey) {
      return NextResponse.json({ error: 'Failed to secure API key' }, { status: 500 });
    }

    await db.collection('admin_users').updateOne(
      { _id: currentUser._id },
      { $set: { groqApiKey: encryptedKey } }
    );

    return NextResponse.json({ success: true, message: 'API key saved securely' });
  } catch (err) {
    console.error('Post bot config error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
