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
      hasKey: !!currentUser.groqApiKey,
      ultraSummarizeMode: !!currentUser.ultraSummarizeMode
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

    const body = await request.json().catch(() => ({}));
    const { apiKey, ultraSummarizeMode } = body;

    const updateDoc = {};

    if (apiKey !== undefined) {
      if (!apiKey || !apiKey.trim()) {
        await db.collection('admin_users').updateOne(
          { _id: currentUser._id },
          { $unset: { groqApiKey: "" } }
        );
      } else {
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
              model: 'llama-3.1-8b-instant',
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

        const encryptedKey = encrypt(trimmedKey);
        if (!encryptedKey) {
          return NextResponse.json({ error: 'Failed to secure API key' }, { status: 500 });
        }
        updateDoc.groqApiKey = encryptedKey;
      }
    }

    if (ultraSummarizeMode !== undefined) {
      updateDoc.ultraSummarizeMode = !!ultraSummarizeMode;
    }

    if (Object.keys(updateDoc).length > 0) {
      await db.collection('admin_users').updateOne(
        { _id: currentUser._id },
        { $set: updateDoc }
      );
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('Post bot config error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
