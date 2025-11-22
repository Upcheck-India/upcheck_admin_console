/**
 * Automated Email Template Testing System
 * Provides automated testing for email rendering across different clients
 */

import { connectToDatabase } from '../../mongodb.js';
import EmailTemplateTester from './templateTester.js';

export class AutomatedEmailTester {
  constructor() {
    this.tester = new EmailTemplateTester();
    this.testSchedule = new Map();
    this.isRunning = false;
  }

  /**
   * Schedule automated tests for email templates
   */
  async scheduleAutomatedTests(templateName, schedule = 'daily') {
    try {
      const { db } = await connectToDatabase();
      
      const scheduledTest = {
        templateName,
        schedule, // 'hourly', 'daily', 'weekly'
        lastRun: null,
        nextRun: this.calculateNextRun(schedule),
        isActive: true,
        createdAt: new Date(),
        testConfig: {
          runFullSuite: true,
          saveResults: true,
          alertOnFailure: true,
          minimumScore: 80
        }
      };

      await db.collection('automated_test_schedules').insertOne(scheduledTest);
      
      return {
        success: true,
        scheduleId: scheduledTest._id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate next run time based on schedule
   */
  calculateNextRun(schedule) {
    const now = new Date();
    
    switch (schedule) {
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Run automated tests for all scheduled templates
   */
  async runScheduledTests() {
    if (this.isRunning) {
      console.log('Automated tests already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🤖 Starting automated email template tests...');

    try {
      const { db } = await connectToDatabase();
      
      // Get all active scheduled tests that are due
      const dueTests = await db.collection('automated_test_schedules')
        .find({
          isActive: true,
          nextRun: { $lte: new Date() }
        })
        .toArray();

      console.log(`Found ${dueTests.length} tests to run`);

      for (const scheduledTest of dueTests) {
        await this.runSingleAutomatedTest(scheduledTest);
      }

      console.log('✅ Automated tests completed');
    } catch (error) {
      console.error('❌ Automated tests failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a single automated test
   */
  async runSingleAutomatedTest(scheduledTest) {
    try {
      console.log(`🧪 Testing template: ${scheduledTest.templateName}`);
      
      const startTime = new Date();
      const results = await this.tester.runFullTestSuite(scheduledTest.templateName);
      const endTime = new Date();

      // Save results
      if (scheduledTest.testConfig.saveResults) {
        await this.tester.saveTestResults({
          ...results,
          automated: true,
          scheduleId: scheduledTest._id,
          executionTime: endTime - startTime
        });
      }

      // Check if results meet minimum requirements
      const passed = results.success && results.overallScore >= scheduledTest.testConfig.minimumScore;
      
      if (!passed && scheduledTest.testConfig.alertOnFailure) {
        await this.sendAlert(scheduledTest, results);
      }

      // Update schedule for next run
      await this.updateSchedule(scheduledTest._id, scheduledTest.schedule, passed);

      console.log(`✅ ${scheduledTest.templateName}: Score ${results.overallScore}/100 ${passed ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      console.error(`❌ Test failed for ${scheduledTest.templateName}:`, error);
      
      // Send failure alert
      if (scheduledTest.testConfig.alertOnFailure) {
        await this.sendAlert(scheduledTest, { error: error.message, success: false });
      }
    }
  }

  /**
   * Update schedule for next run
   */
  async updateSchedule(scheduleId, schedule, passed) {
    try {
      const { db } = await connectToDatabase();
      
      await db.collection('automated_test_schedules').updateOne(
        { _id: scheduleId },
        {
          $set: {
            lastRun: new Date(),
            nextRun: this.calculateNextRun(schedule),
            lastResult: passed ? 'passed' : 'failed'
          }
        }
      );
    } catch (error) {
      console.error('Failed to update schedule:', error);
    }
  }

  /**
   * Send alert for failed tests
   */
  async sendAlert(scheduledTest, results) {
    try {
      const { db } = await connectToDatabase();
      
      const alert = {
        type: 'automated_test_failure',
        templateName: scheduledTest.templateName,
        scheduleId: scheduledTest._id,
        results: {
          success: results.success,
          overallScore: results.overallScore,
          error: results.error
        },
        createdAt: new Date(),
        severity: results.overallScore < 50 ? 'critical' : 'warning'
      };

      await db.collection('test_alerts').insertOne(alert);
      
      // In a real implementation, you might send email/Slack notifications here
      console.log(`🚨 ALERT: Template ${scheduledTest.templateName} failed automated test`);
      
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Run regression tests comparing current vs previous versions
   */
  async runRegressionTests(templateName) {
    try {
      console.log(`🔄 Running regression tests for ${templateName}...`);
      
      // Get current test results
      const currentResults = await this.tester.runFullTestSuite(templateName);
      
      // Get previous test results
      const previousResults = await this.getPreviousTestResults(templateName);
      
      if (!previousResults) {
        console.log('No previous results found for comparison');
        return { success: true, isBaseline: true };
      }

      // Compare results
      const regression = this.detectRegression(currentResults, previousResults);
      
      // Save regression test results
      await this.saveRegressionResults(templateName, currentResults, previousResults, regression);
      
      return {
        success: true,
        regression,
        currentScore: currentResults.overallScore,
        previousScore: previousResults.overallScore,
        scoreDifference: currentResults.overallScore - previousResults.overallScore
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get previous test results for comparison
   */
  async getPreviousTestResults(templateName) {
    try {
      const { db } = await connectToDatabase();
      
      const previousResult = await db.collection('email_test_results')
        .findOne(
          { 
            templateType: templateName,
            automated: { $ne: true } // Exclude automated tests for baseline
          },
          { sort: { runAt: -1 } }
        );

      return previousResult;
    } catch (error) {
      console.error('Failed to get previous results:', error);
      return null;
    }
  }

  /**
   * Detect regression in test results
   */
  detectRegression(current, previous) {
    const regressions = [];
    const improvements = [];
    
    // Overall score regression
    const scoreDiff = current.overallScore - previous.overallScore;
    if (scoreDiff < -5) { // 5 point drop is considered regression
      regressions.push({
        type: 'overall_score',
        current: current.overallScore,
        previous: previous.overallScore,
        difference: scoreDiff
      });
    } else if (scoreDiff > 5) {
      improvements.push({
        type: 'overall_score',
        current: current.overallScore,
        previous: previous.overallScore,
        difference: scoreDiff
      });
    }

    // Client compatibility regression
    if (current.clientCompatibility && previous.clientCompatibility) {
      const compatDiff = current.clientCompatibility.overallScore - previous.clientCompatibility.overallScore;
      if (compatDiff < -5) {
        regressions.push({
          type: 'client_compatibility',
          current: current.clientCompatibility.overallScore,
          previous: previous.clientCompatibility.overallScore,
          difference: compatDiff
        });
      }
    }

    // Accessibility regression
    if (current.accessibility && previous.accessibility) {
      const accessDiff = current.accessibility.score - previous.accessibility.score;
      if (accessDiff < -10) {
        regressions.push({
          type: 'accessibility',
          current: current.accessibility.score,
          previous: previous.accessibility.score,
          difference: accessDiff
        });
      }
    }

    // Performance regression
    if (current.performance && previous.performance) {
      const perfRatings = { excellent: 4, good: 3, fair: 2, poor: 1 };
      const currentRating = perfRatings[current.performance.performance] || 1;
      const previousRating = perfRatings[previous.performance.performance] || 1;
      
      if (currentRating < previousRating) {
        regressions.push({
          type: 'performance',
          current: current.performance.performance,
          previous: previous.performance.performance,
          difference: currentRating - previousRating
        });
      }
    }

    return {
      hasRegression: regressions.length > 0,
      regressions,
      improvements,
      summary: `${regressions.length} regressions, ${improvements.length} improvements`
    };
  }

  /**
   * Save regression test results
   */
  async saveRegressionResults(templateName, current, previous, regression) {
    try {
      const { db } = await connectToDatabase();
      
      await db.collection('regression_test_results').insertOne({
        templateName,
        testType: 'regression',
        currentResults: {
          overallScore: current.overallScore,
          runAt: current.runAt
        },
        previousResults: {
          overallScore: previous.overallScore,
          runAt: previous.runAt
        },
        regression,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Failed to save regression results:', error);
    }
  }

  /**
   * Run performance benchmarks
   */
  async runPerformanceBenchmarks(templateName) {
    try {
      console.log(`⚡ Running performance benchmarks for ${templateName}...`);
      
      const iterations = 10;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        await this.tester.renderTestTemplate(templateName);
        const endTime = process.hrtime.bigint();
        
        const renderTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        results.push(renderTime);
      }

      const avgRenderTime = results.reduce((a, b) => a + b, 0) / results.length;
      const minRenderTime = Math.min(...results);
      const maxRenderTime = Math.max(...results);

      const benchmark = {
        templateName,
        iterations,
        averageRenderTime: avgRenderTime,
        minRenderTime,
        maxRenderTime,
        standardDeviation: this.calculateStandardDeviation(results, avgRenderTime),
        testedAt: new Date()
      };

      // Save benchmark results
      await this.saveBenchmarkResults(benchmark);

      return {
        success: true,
        benchmark
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values, mean) {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDifferences.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Save benchmark results
   */
  async saveBenchmarkResults(benchmark) {
    try {
      const { db } = await connectToDatabase();
      
      await db.collection('performance_benchmarks').insertOne(benchmark);
    } catch (error) {
      console.error('Failed to save benchmark results:', error);
    }
  }

  /**
   * Get automated test status and statistics
   */
  async getAutomatedTestStatus() {
    try {
      const { db } = await connectToDatabase();
      
      const [schedules, recentResults, alerts] = await Promise.all([
        db.collection('automated_test_schedules').find({ isActive: true }).toArray(),
        db.collection('email_test_results').find({ automated: true }).sort({ runAt: -1 }).limit(10).toArray(),
        db.collection('test_alerts').find().sort({ createdAt: -1 }).limit(5).toArray()
      ]);

      return {
        success: true,
        status: {
          activeSchedules: schedules.length,
          recentTests: recentResults.length,
          pendingAlerts: alerts.filter(a => !a.resolved).length,
          schedules: schedules.map(s => ({
            templateName: s.templateName,
            schedule: s.schedule,
            lastRun: s.lastRun,
            nextRun: s.nextRun,
            lastResult: s.lastResult
          })),
          recentResults: recentResults.map(r => ({
            templateType: r.templateType,
            overallScore: r.overallScore,
            runAt: r.runAt,
            success: r.success
          })),
          alerts: alerts.map(a => ({
            type: a.type,
            templateName: a.templateName,
            severity: a.severity,
            createdAt: a.createdAt,
            resolved: a.resolved
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start automated test runner (should be called from a cron job or scheduler)
   */
  async startAutomatedRunner(intervalMinutes = 60) {
    console.log(`🚀 Starting automated test runner (interval: ${intervalMinutes} minutes)`);
    
    // Run immediately
    await this.runScheduledTests();
    
    // Schedule recurring runs
    setInterval(async () => {
      await this.runScheduledTests();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated test runner
   */
  stopAutomatedRunner() {
    console.log('🛑 Stopping automated test runner');
    this.isRunning = false;
  }
}

export default AutomatedEmailTester;