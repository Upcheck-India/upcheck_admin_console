import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb.js';

let initialized = false;
let initPromise = null;

async function initializeAsync() {
  if (initialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      await connectToDatabase();
      const { startJobProcessing } = await import('../../../lib/jobHandlers.js');
      startJobProcessing();
      initialized = true;
      console.log('Job processing system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize job processing system:', error);
      initPromise = null;
    }
  })();
  
  return initPromise;
}

initializeAsync();

export async function GET() {
  return NextResponse.json({ 
    status: 'initialized',
    message: 'Job processing system is running'
  });
}