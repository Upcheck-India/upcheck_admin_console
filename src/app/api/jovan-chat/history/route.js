import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const { sessionId, message, role } = await req.json();
    console.log('Adding message to chat history:', { sessionId, role });

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Validate session exists and is active
    const session = await db.collection('jovan_chat_sessions').findOne({
      _id: new ObjectId(sessionId),
      active: true
    });
    
    if (!session) {
      console.error('Session not found or inactive:', sessionId);
      return NextResponse.json(
        { error: 'Invalid or inactive session' },
        { status: 400 }
      );
    }
    
    // Add message to chat history array
    const chatMessage = {
      message,
      role,
      timestamp: new Date().toISOString()
    };
    
    console.log('Updating session with new message');
    const result = await db.collection('jovan_chat_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { 
        $push: { history: chatMessage },
        $set: { lastMessage: message }
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to update session with new message');
    }

    console.log('Message added successfully');
    return NextResponse.json(chatMessage);
  } catch (error) {
    console.error('Error saving chat message:', error);
    if (error.code) {
      console.error('MongoDB error code:', error.code);
    }
    return NextResponse.json(
      { error: 'Failed to save chat message', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId || !ObjectId.isValid(sessionId)) {
      console.error('Invalid session ID provided:', sessionId);
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }
    
    console.log('Fetching chat history for session:', sessionId);
    // Get session and return its history
    const session = await db.collection('jovan_chat_sessions').findOne(
      { _id: new ObjectId(sessionId) },
      { projection: { history: 1 } }
    );

    if (!session) {
      console.error('Session not found:', sessionId);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    console.log('Chat history fetched successfully');
    return NextResponse.json(session.history || []);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    if (error.code) {
      console.error('MongoDB error code:', error.code);
    }
    return NextResponse.json(
      { error: 'Failed to fetch chat history', details: error.message },
      { status: 500 }
    );
  }
}