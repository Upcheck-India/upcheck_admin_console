import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user: currentUser, db } = auth;
    const userId = currentUser._id.toString();

    const { chatId, chatType, muteOption } = await request.json();

    if (!chatId || !chatType || !muteOption) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['dm', 'team', 'group'].includes(chatType)) {
      return NextResponse.json({ error: 'Invalid chatType' }, { status: 400 });
    }

    if (muteOption === 'unmute') {
      await db.collection('chat_mutes').deleteOne({ userId, chatId, chatType });
      return NextResponse.json({ success: true, isMuted: false });
    }

    let mutedUntil = null;
    let isForever = false;

    if (muteOption === 'forever') {
      isForever = true;
    } else {
      let minutes = 0;
      if (muteOption === '15m') minutes = 15;
      else if (muteOption === '1h') minutes = 60;
      else if (muteOption === '8h') minutes = 480;
      else if (muteOption === '24h') minutes = 1440;
      else if (muteOption === '7d') minutes = 10080;
      else {
        minutes = parseInt(muteOption, 10) || 0;
      }

      if (minutes <= 0) {
        return NextResponse.json({ error: 'Invalid mute duration' }, { status: 400 });
      }

      mutedUntil = new Date(Date.now() + minutes * 60 * 1000);
    }

    const muteDoc = {
      userId,
      chatId,
      chatType,
      mutedUntil,
      isForever,
      updatedAt: new Date()
    };

    await db.collection('chat_mutes').updateOne(
      { userId, chatId, chatType },
      { $set: muteDoc },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      isMuted: true,
      isForever,
      mutedUntil: mutedUntil ? mutedUntil.toISOString() : null
    });
  } catch (error) {
    console.error('[Chat Mute POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
