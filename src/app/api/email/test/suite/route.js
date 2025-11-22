/**
 * Email Template Test Suite API
 * Runs comprehensive testing on email templates
 */

import { NextResponse } from 'next/server';
import EmailTemplateTester from '../../../../../lib/email/testing/templateTester.js';
import TemplateVersionManager from '../../../../../lib/email/testing/templateVersioning.js';

const tester = new EmailTemplateTester();
const versionManager = new TemplateVersionManager();

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      templateType, 
      version, 
      tests = ['all'],
      saveResults = true 
    } = body;

    if (!templateType) {
      return NextResponse.json({
        success: false,
        error: 'Template type is required'
      }, { status: 400 });
    }

    let testResults;

    if (tests.includes('all')) {
      // Run full test suite
      testResults = await tester.runFullTestSuite(templateType);
    } else {
      // Run specific tests
      testResults = await runSpecificTests(templateType, tests);
    }

    // Save results to database if requested
    if (saveResults && testResults.success) {
      await tester.saveTestResults(testResults);
      
      // Update version with test results if version specified
      if (version) {
        await updateVersionTestResults(templateType, version, testResults);
      }
    }

    return NextResponse.json({
      success: true,
      results: testResults
    });

  } catch (error) {
    console.error('Test suite error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run test suite'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (!templateType) {
      return NextResponse.json({
        success: false,
        error: 'Template type is required'
      }, { status: 400 });
    }

    const history = await tester.getTestHistory(templateType, limit);

    return NextResponse.json(history);

  } catch (error) {
    console.error('Test history error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve test history'
    }, { status: 500 });
  }
}

async function runSpecificTests(templateType, tests) {
  const results = {
    templateType,
    testSuiteVersion: '1.0.0',
    runAt: new Date(),
    success: true
  };

  try {
    // Always render template first
    results.rendering = await tester.renderTestTemplate(templateType);
    
    if (!results.rendering.success) {
      throw new Error(`Template rendering failed: ${results.rendering.error}`);
    }

    // Run requested tests
    for (const testType of tests) {
      switch (testType) {
        case 'compatibility':
          results.clientCompatibility = await tester.testClientCompatibility(templateType);
          break;
        
        case 'spam':
          results.spamScore = await tester.checkSpamScore(
            results.rendering.html,
            results.rendering.text,
            results.rendering.subject
          );
          break;
        
        case 'accessibility':
          results.accessibility = await tester.checkAccessibility(results.rendering.html);
          break;
        
        case 'performance':
          results.performance = await tester.monitorPerformance(results.rendering.html);
          break;
        
        default:
          console.warn(`Unknown test type: ${testType}`);
      }
    }

    // Calculate overall score if multiple tests were run
    if (tests.length > 1) {
      results.overallScore = tester.calculateOverallScore(results);
    }

  } catch (error) {
    results.success = false;
    results.error = error.message;
  }

  return results;
}

async function updateVersionTestResults(templateType, version, testResults) {
  try {
    const { connectToDatabase } = await import('../../../../../lib/mongodb.js');
    const { db } = await connectToDatabase();
    
    await db.collection('email_template_versions').updateOne(
      { templateName: templateType, version: parseInt(version) },
      { 
        $set: { 
          testResults: {
            overallScore: testResults.overallScore,
            runAt: testResults.runAt,
            clientCompatibility: testResults.clientCompatibility?.overallScore,
            spamScore: testResults.spamScore?.score,
            accessibility: testResults.accessibility?.score,
            performance: testResults.performance?.performance
          }
        } 
      }
    );
  } catch (error) {
    console.error('Failed to update version test results:', error);
  }
}