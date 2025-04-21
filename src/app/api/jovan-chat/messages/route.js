import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { sessionId, message, role } = await req.json();

    const response = await fetch(
      `https://upcheck-automate.onrender.com/webhook/chat-message-endpoint/chat/${sessionId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message,
          role
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if the response has content
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid response format: Expected JSON');
    }

    const text = await response.text();
    if (!text) {
      throw new Error('Empty response received');
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, 'Response text:', text);
      throw new Error('Invalid JSON in response');
    }
  } catch (error) {
    console.error('Error in chat message proxy:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat message', 
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}