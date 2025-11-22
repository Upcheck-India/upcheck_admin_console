/**
 * Migration Runner Utility
 * Handles running database migrations for the application
 */

import { runIfNeeded as runRecurringMeetingsSetup } from './001_recurring_meetings_setup.js';

// List of all available migrations in order
const MIGRATIONS = [
  {
    name: '001_recurring_meetings_setup',
    description: 'Set up database schema for recurring meetings feature',
    runner: runRecurringMeetingsSetup
  }
];

/**
 * Run all pending migrations
 */
export async function runAllMigrations() {
  console.log('Starting migration runner...');
  
  const results = [];
  
  for (const migration of MIGRATIONS) {
    try {
      console.log(`\n--- Running migration: ${migration.name} ---`);
      console.log(`Description: ${migration.description}`);
      
      const result = await migration.runner();
      
      results.push({
        name: migration.name,
        success: true,
        skipped: result.skipped || false,
        error: null
      });
      
      if (result.skipped) {
        console.log(`✓ Migration ${migration.name} was already applied`);
      } else {
        console.log(`✓ Migration ${migration.name} completed successfully`);
      }
      
    } catch (error) {
      console.error(`✗ Migration ${migration.name} failed:`, error);
      
      results.push({
        name: migration.name,
        success: false,
        skipped: false,
        error: error.message
      });
      
      // Stop on first failure to prevent cascading issues
      break;
    }
  }
  
  console.log('\n--- Migration Summary ---');
  results.forEach(result => {
    const status = result.success 
      ? (result.skipped ? '⏭️  SKIPPED' : '✅ SUCCESS') 
      : '❌ FAILED';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const failedCount = results.filter(r => !r.success).length;
  const successCount = results.filter(r => r.success && !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;
  
  console.log(`\nTotal: ${results.length} migrations`);
  console.log(`Success: ${successCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
  
  if (failedCount > 0) {
    throw new Error(`${failedCount} migration(s) failed`);
  }
  
  return results;
}

/**
 * Run migrations and return a simple success/failure result
 */
export async function runMigrationsIfNeeded() {
  try {
    await runAllMigrations();
    return { success: true };
  } catch (error) {
    console.error('Migration runner failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if all migrations have been applied
 */
export async function checkMigrationStatus() {
  const results = [];
  
  for (const migration of MIGRATIONS) {
    try {
      // Import the migration module to check if it's applied
      const migrationModule = await import(`./${migration.name}.js`);
      const isApplied = await migrationModule.isApplied();
      
      results.push({
        name: migration.name,
        description: migration.description,
        applied: isApplied
      });
    } catch (error) {
      results.push({
        name: migration.name,
        description: migration.description,
        applied: false,
        error: error.message
      });
    }
  }
  
  return results;
}