import { NextResponse } from 'next/server';
import { sendSeriesNotification } from '../../../../lib/notificationScheduler.js';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import RecurringSeries from '../../../../models/RecurringSeries.js';

export async function POST(request) {
  try {
    const { seriesId } = await request.json();
    
    if (!seriesId) {
      return NextResponse.json({ error: 'Series ID is required' }, { status: 400 });
    }
    
    console.log(`Testing series notification for series: ${seriesId}`);
    
    // Connect to database
    await connectToDatabase();
    
    // Get the series
    const series = await RecurringSeries.findById(seriesId);
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }
    
    console.log(`Found series: ${series.title}`);
    console.log(`Participants: ${series.participants.join(', ')}`);
    console.log(`Series notification enabled: ${series.seriesNotification?.enabled}`);
    console.log(`Series notification sent: ${series.seriesNotification?.sent}`);
    
    // Send series notification
    const result = await sendSeriesNotification(seriesId, series.participants);
    
    return NextResponse.json({ 
      success: true, 
      message: `Sent ${result.length} series notifications`,
      notifications: result.length
    });
    
  } catch (error) {
    console.error('Error testing series notification:', error);
    return NextResponse.json({ 
      error: 'Failed to send series notification',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get the most recent series for testing
    await connectToDatabase();
    
    const series = await RecurringSeries.findOne().sort({ createdAt: -1 });
    
    if (!series) {
      return NextResponse.json({ error: 'No series found' }, { status: 404 });
    }
    
    return NextResponse.json({
      seriesId: series._id,
      title: series.title,
      participants: series.participants,
      seriesNotification: series.seriesNotification
    });
    
  } catch (error) {
    console.error('Error getting series info:', error);
    return NextResponse.json({ 
      error: 'Failed to get series info',
      details: error.message 
    }, { status: 500 });
  }
}