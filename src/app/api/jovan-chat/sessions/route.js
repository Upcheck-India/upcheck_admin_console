import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  let client;
  try {
    const { username } = await req.json();
    console.log('Creating new chat session for user:', username);

    client = await clientPromise;
    const db = client.db("cms_automation");
    
    // Create new chat session with a unique endpoint sessionId
    const session = {
      username,
      createdAt: new Date().toISOString(),
      active: true,
      lastMessage: null,
      title: 'New Chat',
      endpointSessionId: new ObjectId().toString() // Add this unique ID for the chat endpoint
    };
    
    console.log('Inserting session:', session);
    const result = await db.collection('jovan_chat_sessions').insertOne(session);
    console.log('Session created with ID:', result.insertedId.toString());
    
    return NextResponse.json({
      sessionId: result.insertedId.toString(),
      endpointSessionId: session.endpointSessionId, // Include this in the response
      username,
      createdAt: session.createdAt,
      active: true,
      title: session.title
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    if (error.code) {
      console.error('MongoDB error code:', error.code);
    }
    return NextResponse.json(
      { error: 'Failed to create chat session', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("cms_automation");
    const username = req.headers.get('x-username');
    
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }
    
    // Get all active chat sessions for the user
    const sessions = await db.collection('jovan_chat_sessions')
      .find({ username, active: true })
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions' },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const { sessionId, title } = await req.json();
    if (!sessionId || !title) {
      return NextResponse.json(
        { error: 'Session ID and title are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("cms_automation");

    const result = await db.collection('jovan_chat_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { title } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, title });
  } catch (error) {
    console.error('Error updating chat session:', error);
    return NextResponse.json(
      { error: 'Failed to update chat session' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("cms_automation");

    // Hard delete the session instead of soft delete
    const result = await db.collection('jovan_chat_sessions').deleteOne({
      _id: new ObjectId(sessionId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat session' },
      { status: 500 }
    );
  }
}