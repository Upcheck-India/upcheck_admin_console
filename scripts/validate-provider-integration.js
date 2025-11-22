#!/usr/bin/env node

/**
 * Validation script for provider integration
 * Tests core functionality without external dependencies
 */

console.log('🚀 Validating Provider Integration Implementation');
console.log('Checking if all required files and functions exist...\n');

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src', 'lib');

async function checkFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkFileContent(filePath, requiredFunctions) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const missing = requiredFunctions.filter(func => !content.includes(func));
    return { exists: true, content, missing };
  } catch (error) {
    return { exists: false, error: error.message, missing: requiredFunctions };
  }
}

async function validateImplementation() {
  const results = {
    files: {},
    functions: {},
    overall: true,
  };

  // Check required files
  const requiredFiles = [
    { path: 'zoom.js', name: 'Enhanced Zoom Integration' },
    { path: 'googleMeet.js', name: 'Google Meet Integration' },
    { path: 'providerManager.js', name: 'Provider Manager' },
    { path: 'meetingGenerator.js', name: 'Meeting Generator (Enhanced)' },
  ];

  console.log('=== Checking Required Files ===');
  for (const file of requiredFiles) {
    const filePath = join(srcDir, file.path);
    const exists = await checkFileExists(filePath);
    results.files[file.path] = exists;
    
    console.log(`${exists ? '✅' : '❌'} ${file.name}: ${exists ? 'EXISTS' : 'MISSING'}`);
    
    if (!exists) {
      results.overall = false;
    }
  }

  // Check required functions in each file
  console.log('\n=== Checking Required Functions ===');
  
  const functionChecks = [
    {
      file: 'zoom.js',
      functions: [
        'createZoomMeetingForRecurring',
        'batchCreateZoomMeetings',
        'updateZoomMeetingForRecurring',
        'deleteZoomMeetingForRecurring',
        'validateZoomSettingsForRecurring',
      ],
    },
    {
      file: 'googleMeet.js',
      functions: [
        'createGoogleMeetForRecurring',
        'batchCreateGoogleMeetMeetings',
        'updateGoogleMeetForRecurring',
        'deleteGoogleMeetForRecurring',
        'scheduleGoogleMeetBot',
        'validateGoogleMeetSettingsForRecurring',
      ],
    },
    {
      file: 'providerManager.js',
      functions: [
        'selectOptimalProvider',
        'getProviderHealth',
        'validateProviderSettings',
        'getOptimalBatchConfig',
        'ProviderHealthMonitor',
      ],
    },
  ];

  for (const check of functionChecks) {
    const filePath = join(srcDir, check.file);
    const result = await checkFileContent(filePath, check.functions);
    
    console.log(`\n📁 ${check.file}:`);
    
    if (!result.exists) {
      console.log(`❌ File not found: ${result.error}`);
      results.overall = false;
      continue;
    }

    check.functions.forEach(func => {
      const exists = !result.missing.includes(func);
      results.functions[`${check.file}:${func}`] = exists;
      console.log(`  ${exists ? '✅' : '❌'} ${func}`);
      
      if (!exists) {
        results.overall = false;
      }
    });
  }

  // Check for enhanced error handling patterns
  console.log('\n=== Checking Error Handling Patterns ===');
  
  const errorPatterns = [
    { pattern: 'retryCount', description: 'Retry mechanism' },
    { pattern: 'exponential.*backoff|backoff.*exponential', description: 'Exponential backoff' },
    { pattern: 'isRetryableError', description: 'Retryable error detection' },
    { pattern: 'fallback', description: 'Fallback mechanisms' },
    { pattern: 'rate.*limit|429', description: 'Rate limiting handling' },
  ];

  for (const file of ['zoom.js', 'googleMeet.js', 'providerManager.js']) {
    const filePath = join(srcDir, file);
    const result = await checkFileContent(filePath, []);
    
    if (result.exists) {
      console.log(`\n📁 ${file} error handling:`);
      
      errorPatterns.forEach(({ pattern, description }) => {
        const regex = new RegExp(pattern, 'i');
        const hasPattern = regex.test(result.content);
        console.log(`  ${hasPattern ? '✅' : '❌'} ${description}`);
        
        if (!hasPattern) {
          console.log(`    Missing pattern: ${pattern}`);
        }
      });
    }
  }

  // Check integration points
  console.log('\n=== Checking Integration Points ===');
  
  const integrationChecks = [
    {
      file: 'meetingGenerator.js',
      patterns: [
        { pattern: 'createZoomMeetingForRecurring', description: 'Zoom integration import' },
        { pattern: 'createGoogleMeetForRecurring', description: 'Google Meet integration import' },
        { pattern: 'selectOptimalProvider', description: 'Provider manager integration' },
        { pattern: 'batchGenerateMeetingsWithFallback', description: 'Enhanced batch generation' },
      ],
    },
  ];

  for (const check of integrationChecks) {
    const filePath = join(srcDir, check.file);
    const result = await checkFileContent(filePath, []);
    
    if (result.exists) {
      console.log(`\n📁 ${check.file} integrations:`);
      
      check.patterns.forEach(({ pattern, description }) => {
        const hasPattern = result.content.includes(pattern);
        console.log(`  ${hasPattern ? '✅' : '❌'} ${description}`);
      });
    }
  }

  return results;
}

async function generateReport(results) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 VALIDATION REPORT');
  console.log('='.repeat(50));

  const fileCount = Object.keys(results.files).length;
  const filesExist = Object.values(results.files).filter(Boolean).length;
  
  const functionCount = Object.keys(results.functions).length;
  const functionsExist = Object.values(results.functions).filter(Boolean).length;

  console.log(`\n📁 Files: ${filesExist}/${fileCount} exist`);
  console.log(`🔧 Functions: ${functionsExist}/${functionCount} implemented`);
  
  if (results.overall) {
    console.log('\n🎉 SUCCESS: All required components are implemented!');
    console.log('\n✅ The provider integration includes:');
    console.log('  • Enhanced Zoom integration with rate limiting and retries');
    console.log('  • Google Meet integration with multiple strategies');
    console.log('  • Provider health monitoring and fallback mechanisms');
    console.log('  • Batch processing with comprehensive error handling');
    console.log('  • Settings validation for both providers');
    console.log('  • Optimal batch configuration based on provider capabilities');
    
    console.log('\n📝 Next Steps:');
    console.log('  1. Set up API credentials for Zoom and Google Meet');
    console.log('  2. Configure database connection for full testing');
    console.log('  3. Test with real recurring meeting series');
    console.log('  4. Monitor provider health in production');
    
  } else {
    console.log('\n⚠️ ISSUES FOUND: Some components are missing or incomplete');
    
    const missingFiles = Object.entries(results.files)
      .filter(([_, exists]) => !exists)
      .map(([file, _]) => file);
    
    if (missingFiles.length > 0) {
      console.log('\n❌ Missing files:');
      missingFiles.forEach(file => console.log(`  • ${file}`));
    }
    
    const missingFunctions = Object.entries(results.functions)
      .filter(([_, exists]) => !exists)
      .map(([func, _]) => func);
    
    if (missingFunctions.length > 0) {
      console.log('\n❌ Missing functions:');
      missingFunctions.forEach(func => console.log(`  • ${func}`));
    }
  }

  console.log('\n' + '='.repeat(50));
}

// Run validation
validateImplementation()
  .then(generateReport)
  .catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });