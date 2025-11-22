import { NextResponse } from 'next/server';
import { startJobProcessing } from '../../../lib/jobHandlers.js';

let initialized = false;

// Initialize job processing when the API is first called
if (!initialized) {
  try {
    startJobProcessing();
    initialized = true;
    console.log('Job processing system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize job processing system:', error);
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'initialized',
    message: 'Job processing system is running'
  });
}