import { NextResponse } from 'next/server';

const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 30000; // 30 seconds
const MAX_TIMEOUT = 120000; // 2 minutes

async function fetchWithRetry(url, options, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeout = Math.min(INITIAL_TIMEOUT * Math.pow(2, retryCount), MAX_TIMEOUT);
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      if ((status === 504 || status === 503 || status === 502) && retryCount < MAX_RETRIES) {
        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retryCount + 1);
      }
      throw new Error(`HTTP error! status: ${status}`);
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (retryCount < MAX_RETRIES) {
        // Retry on timeout
        return fetchWithRetry(url, options, retryCount + 1);
      }
      throw new Error('Request timed out after multiple retries');
    }
    throw error;
  }
}

export async function POST(req) {
  try {
    const { sessionId, message, role } = await req.json();
    
    const response = await fetchWithRetry(
      `https://upcheck-automate.onrender.com/webhook-test/chat-message-endpoint/chat/${sessionId}`,
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

    const text = await response.text();
    if (!text) {
      throw new Error('Empty response received');
    }

    try {
      // Try to parse as JSON first
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      // If not JSON, return the plain text as a response object
      return NextResponse.json({ 
        message: text,
        isPlainText: true
      });
    }
  } catch (error) {
    console.error('Error in chat message proxy:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat message', 
        details: error.message,
        retryable: error.message.includes('timed out') || error.message.includes('504'),
        timestamp: new Date().toISOString()
      },
      { status: error.message.includes('timed out') ? 504 : 500 }
    );
  }
}