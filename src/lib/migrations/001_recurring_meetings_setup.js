/**
 * Database Migration: Recurring Meetings Setup
 * Creates indexes and performs schema updates for recurring meetings feature
 */

import clientPromise from '../mongodb.js';

export async function up() {
  const client = await clientPromise;
  const db = client.db("resources");
  
  console.log('Running migration: 001_recurring_meetings_setup');
  
  try {
    // Create indexes for recurring_series collection
    console.log('Creating indexes for recurring_series collection...');
    await db.collection('recurring_series').createIndexes([
      { key: { nextGenerationDate: 1, isActive: 1 }, name: 'nextGeneration_active' },
      { key: { hostId: 1 }, name: 'hostId' },
      { key: { createdAt: -1 }, name: 'createdAt_desc' },
      { key: { isActive: 1, createdAt: -1 }, name: 'active_created' }
    ]);
    
    // Create indexes for scheduled_jobs collection
    console.log('Creating indexes for scheduled_jobs collection...');
    await db.collection('scheduled_jobs').createIndexes([
      { key: { 'scheduling.executeAt': 1, status: 1 }, name: 'executeAt_status' },
      { key: { type: 1, status: 1 }, name: 'type_status' },
      { key: { 'payload.seriesId': 1 }, name: 'seriesId' },
      { key: { priority: -1, 'scheduling.executeAt': 1 }, name: 'priority_executeAt' },
      { key: { status: 1, 'scheduling.createdAt': 1 }, name: 'status_created' }
    ]);
    
    // Create indexes for notifications collection
    console.log('Creating indexes for notifications collection...');
    await db.collection('notifications').createIndexes([
      { key: { scheduledFor: 1, status: 1 }, name: 'scheduledFor_status' },
      { key: { meetingId: 1, type: 1 }, name: 'meetingId_type' },
      { key: { seriesId: 1, type: 1 }, name: 'seriesId_type' },
      { key: { recipient: 1, status: 1 }, name: 'recipient_status' },
      { key: { 'tracking.token': 1 }, name: 'tracking_token', unique: true, sparse: true },
      { key: { status: 1, createdAt: 1 }, name: 'status_created' }
    ]);
    
    // Update existing events collection with new indexes for recurring meetings
    console.log('Creating additional indexes for events collection...');
    await db.collection('events').createIndexes([
      { key: { seriesId: 1, startTime: 1 }, name: 'seriesId_startTime' },
      { key: { 'recurrenceInstance.originalDate': 1 }, name: 'recurrence_originalDate' },
      { key: { status: 1, startTime: 1 }, name: 'status_startTime' },
      { key: { 'tracking.token': 1 }, name: 'events_tracking_token', sparse: true }
    ]);
    
    // Check if we need to add new fields to existing events
    console.log('Checking for existing events to update...');
    const eventsNeedingUpdate = await db.collection('events').countDocuments({
      $or: [
        { seriesId: { $exists: false } },
        { recurrenceInstance: { $exists: false } },
        { overrides: { $exists: false } },
        { status: { $exists: false } }
      ]
    });
    
    if (eventsNeedingUpdate > 0) {
      console.log(`Updating ${eventsNeedingUpdate} existing events with new fields...`);
      
      // Add new fields to existing events
      await db.collection('events').updateMany(
        { seriesId: { $exists: false } },
        { 
          $set: { 
            seriesId: null,
            recurrenceInstance: null,
            overrides: null,
            status: 'scheduled'
          } 
        }
      );
      
      console.log('Updated existing events with new recurring meeting fields');
    }
    
    // Create a migration tracking collection if it doesn't exist
    await db.collection('migrations').createIndex({ name: 1 }, { unique: true });
    
    // Record this migration as completed
    await db.collection('migrations').updateOne(
      { name: '001_recurring_meetings_setup' },
      { 
        $set: { 
          name: '001_recurring_meetings_setup',
          completedAt: new Date(),
          description: 'Set up database schema for recurring meetings feature'
        } 
      },
      { upsert: true }
    );
    
    console.log('Migration 001_recurring_meetings_setup completed successfully');
    return { success: true };
    
  } catch (error) {
    console.error('Migration 001_recurring_meetings_setup failed:', error);
    throw error;
  }
}

export async function down() {
  const client = await clientPromise;
  const db = client.db("resources");
  
  console.log('Rolling back migration: 001_recurring_meetings_setup');
  
  try {
    // Drop indexes for recurring_series collection
    console.log('Dropping recurring_series indexes...');
    try {
      await db.collection('recurring_series').dropIndexes();
    } catch (e) {
      console.log('No recurring_series indexes to drop');
    }
    
    // Drop indexes for scheduled_jobs collection
    console.log('Dropping scheduled_jobs indexes...');
    try {
      await db.collection('scheduled_jobs').dropIndexes();
    } catch (e) {
      console.log('No scheduled_jobs indexes to drop');
    }
    
    // Drop indexes for notifications collection
    console.log('Dropping notifications indexes...');
    try {
      await db.collection('notifications').dropIndexes();
    } catch (e) {
      console.log('No notifications indexes to drop');
    }
    
    // Drop the new indexes from events collection (keep existing ones)
    console.log('Dropping new events indexes...');
    try {
      await db.collection('events').dropIndex('seriesId_startTime');
      await db.collection('events').dropIndex('recurrence_originalDate');
      await db.collection('events').dropIndex('status_startTime');
      await db.collection('events').dropIndex('events_tracking_token');
    } catch (e) {
      console.log('Some events indexes may not exist to drop');
    }
    
    // Remove new fields from existing events
    console.log('Removing recurring meeting fields from existing events...');
    await db.collection('events').updateMany(
      {},
      { 
        $unset: { 
          seriesId: "",
          recurrenceInstance: "",
          overrides: "",
          status: ""
        } 
      }
    );
    
    // Remove migration record
    await db.collection('migrations').deleteOne({ name: '001_recurring_meetings_setup' });
    
    console.log('Migration 001_recurring_meetings_setup rolled back successfully');
    return { success: true };
    
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}

// Helper function to check if migration has been run
export async function isApplied() {
  const client = await clientPromise;
  const db = client.db("resources");
  
  const migration = await db.collection('migrations').findOne({ 
    name: '001_recurring_meetings_setup' 
  });
  
  return !!migration;
}

// Helper function to run migration if not already applied
export async function runIfNeeded() {
  if (!(await isApplied())) {
    console.log('Running migration 001_recurring_meetings_setup...');
    return await up();
  } else {
    console.log('Migration 001_recurring_meetings_setup already applied');
    return { success: true, skipped: true };
  }
}