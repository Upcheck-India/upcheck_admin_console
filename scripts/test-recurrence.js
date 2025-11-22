#!/usr/bin/env node

/**
 * Test Runner Script for Recurrence Engine
 * Runs the recurrence engine unit tests
 */

import { runner } from '../src/lib/__tests__/recurrence.test.js';

async function runTests() {
  console.log('🧪 Starting Recurrence Engine Test Suite\n');
  
  try {
    const success = await runner.run();
    
    if (success) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test runner crashed:', error);
    process.exit(1);
  }
}

runTests();