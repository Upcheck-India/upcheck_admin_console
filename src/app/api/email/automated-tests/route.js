/**
 * Automated Email Testing API
 * Manages automated testing schedules and execution
 */

import { NextResponse } from 'next/server';
import AutomatedEmailTester from '../../../../lib/email/testing/automatedTests.js';

const automatedTester = new AutomatedEmailTester();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        const status = await automatedTester.getAutomatedTestStatus();
        return NextResponse.json(status);

      case 'run':
        const templateName = searchParams.get('template');
        if (!templateName) {
          return NextResponse.json({
            success: false,
            error: 'Template name is required for manual run'
          }, { status: 400 });
        }

        // Run tests for specific template
        await automatedTester.runScheduledTests();
        
        return NextResponse.json({
          success: true,
          message: 'Automated tests executed'
        });

      case 'regression':
        const regressionTemplate = searchParams.get('template');
        if (!regressionTemplate) {
          return NextResponse.json({
            success: false,
            error: 'Template name is required for regression test'
          }, { status: 400 });
        }

        const regressionResults = await automatedTester.runRegressionTests(regressionTemplate);
        return NextResponse.json(regressionResults);

      case 'benchmark':
        const benchmarkTemplate = searchParams.get('template');
        if (!benchmarkTemplate) {
          return NextResponse.json({
            success: false,
            error: 'Template name is required for benchmark'
          }, { status: 400 });
        }

        const benchmarkResults = await automatedTester.runPerformanceBenchmarks(benchmarkTemplate);
        return NextResponse.json(benchmarkResults);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported: status, run, regression, benchmark'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Automated testing API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to execute automated testing operation'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, templateName, schedule, config } = body;

    if (!action || !templateName) {
      return NextResponse.json({
        success: false,
        error: 'Action and template name are required'
      }, { status: 400 });
    }

    switch (action) {
      case 'schedule':
        const scheduleResult = await automatedTester.scheduleAutomatedTests(
          templateName,
          schedule || 'daily'
        );
        return NextResponse.json(scheduleResult);

      case 'run-now':
        // Run immediate test for template
        const testResult = await automatedTester.runSingleAutomatedTest({
          templateName,
          testConfig: config || {
            runFullSuite: true,
            saveResults: true,
            alertOnFailure: false,
            minimumScore: 80
          }
        });
        
        return NextResponse.json({
          success: true,
          message: 'Test executed',
          results: testResult
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported: schedule, run-now'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Automated testing POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to execute automated testing operation'
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const templateName = searchParams.get('template');

    if (!scheduleId && !templateName) {
      return NextResponse.json({
        success: false,
        error: 'Schedule ID or template name is required'
      }, { status: 400 });
    }

    const { connectToDatabase } = await import('../../../../lib/mongodb.js');
    const { db } = await connectToDatabase();

    let filter = {};
    if (scheduleId) {
      filter._id = scheduleId;
    } else {
      filter.templateName = templateName;
    }

    const result = await db.collection('automated_test_schedules').updateMany(
      filter,
      { $set: { isActive: false, deactivatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      message: `Deactivated ${result.modifiedCount} scheduled tests`
    });

  } catch (error) {
    console.error('Automated testing DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to deactivate automated tests'
    }, { status: 500 });
  }
}