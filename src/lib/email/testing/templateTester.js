/**
 * Email Template Testing and Validation System
 * Provides comprehensive testing capabilities for email templates
 */

import { generateSeriesNotificationHtml, generateSeriesNotificationText } from '../templates/seriesNotification.js';
import { generateReminderNotificationHtml, generateReminderNotificationText } from '../templates/reminderNotification.js';
// Database connection is optional for testing
let connectToDatabase = null;

async function getDbConnection() {
  if (connectToDatabase === null) {
    try {
      const mongoModule = await import('../../mongodb.js');
      connectToDatabase = mongoModule.connectToDatabase;
    } catch (error) {
      console.warn('Database connection not available for testing');
      connectToDatabase = false;
    }
  }
  return connectToDatabase;
}

export class EmailTemplateTester {
  constructor() {
    this.testResults = new Map();
    this.clientTests = [
      'gmail-web', 'gmail-mobile', 'outlook-web', 'outlook-desktop',
      'apple-mail', 'yahoo-mail', 'thunderbird', 'samsung-email',
      'outlook-mobile', 'gmail-app', 'apple-mail-mobile', 'protonmail'
    ];
  }

  /**
   * Generate test data for template rendering
   */
  generateTestData(templateType = 'series') {
    const baseData = {
      meetingTitle: 'Weekly Team Standup',
      hostName: 'John Doe',
      hostEmail: 'john.doe@company.com',
      participants: [
        { email: 'alice@company.com', name: 'Alice Smith' },
        { email: 'bob@company.com', name: 'Bob Johnson' }
      ],
      createdAt: new Date(),
      trackingToken: 'test-token-123'
    };

    if (templateType === 'series') {
      return {
        ...baseData,
        recurrencePattern: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
          endCondition: { type: 'count', occurrenceCount: 10 }
        },
        upcomingMeetings: [
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-17T10:00:00Z'),
          new Date('2024-01-19T10:00:00Z'),
          new Date('2024-01-22T10:00:00Z'),
          new Date('2024-01-24T10:00:00Z')
        ],
        totalMeetings: 10,
        seriesId: 'test-series-123'
      };
    }

    return {
      ...baseData,
      meetingId: 'test-meeting-123',
      startTime: new Date('2024-01-15T10:00:00Z'),
      duration: 60,
      joinUrl: 'https://zoom.us/j/123456789',
      reminderType: '1h'
    };
  }

  /**
   * Render template with test data
   */
  async renderTestTemplate(templateType, variant = 'default') {
    try {
      const testData = this.generateTestData(templateType);
      
      let rendered;
      if (templateType === 'series') {
        const html = generateSeriesNotificationHtml(testData, testData.upcomingMeetings, { trackingToken: testData.trackingToken });
        const text = generateSeriesNotificationText(testData, testData.upcomingMeetings, { trackingToken: testData.trackingToken });
        rendered = {
          html,
          text,
          subject: `New Meeting Series: ${testData.meetingTitle}`
        };
      } else if (templateType === 'reminder') {
        const html = generateReminderNotificationHtml(testData, { trackingToken: testData.trackingToken });
        const text = generateReminderNotificationText(testData, { trackingToken: testData.trackingToken });
        rendered = {
          html,
          text,
          subject: `Meeting Reminder: ${testData.meetingTitle}`
        };
      } else {
        throw new Error(`Unknown template type: ${templateType}`);
      }

      return {
        success: true,
        html: rendered.html,
        text: rendered.text,
        subject: rendered.subject,
        testData,
        renderedAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        testData: null,
        renderedAt: new Date()
      };
    }
  }

  /**
   * Test template rendering across different email clients
   */
  async testClientCompatibility(templateType) {
    const results = {};
    const rendered = await this.renderTestTemplate(templateType);
    
    if (!rendered.success) {
      return { error: rendered.error };
    }

    for (const client of this.clientTests) {
      results[client] = await this.testEmailClient(rendered.html, client);
    }

    return {
      templateType,
      clientResults: results,
      overallScore: this.calculateCompatibilityScore(results),
      testedAt: new Date()
    };
  }

  /**
   * Simulate email client rendering test
   */
  async testEmailClient(html, clientName) {
    // Simulate different client capabilities and limitations
    const clientSpecs = {
      'gmail-web': { css: 'full', images: true, darkMode: true, maxWidth: 600 },
      'gmail-mobile': { css: 'limited', images: true, darkMode: true, maxWidth: 320 },
      'outlook-web': { css: 'limited', images: true, darkMode: false, maxWidth: 600 },
      'outlook-desktop': { css: 'very-limited', images: false, darkMode: false, maxWidth: 600 },
      'apple-mail': { css: 'full', images: true, darkMode: true, maxWidth: 600 },
      'yahoo-mail': { css: 'limited', images: true, darkMode: false, maxWidth: 600 },
      'thunderbird': { css: 'limited', images: true, darkMode: true, maxWidth: 600 },
      'samsung-email': { css: 'limited', images: true, darkMode: true, maxWidth: 320 }
    };

    const spec = clientSpecs[clientName] || clientSpecs['gmail-web'];
    
    return {
      client: clientName,
      supported: true,
      issues: this.detectClientIssues(html, spec),
      renderTime: Math.random() * 1000 + 500, // Simulate render time
      score: Math.floor(Math.random() * 20) + 80 // Simulate score 80-100
    };
  }

  /**
   * Detect potential rendering issues for specific client
   */
  detectClientIssues(html, clientSpec) {
    const issues = [];
    
    // Check for CSS support issues
    if (clientSpec.css === 'very-limited' && html.includes('flexbox')) {
      issues.push('Flexbox not supported in this client');
    }
    
    if (clientSpec.css === 'limited' && html.includes('grid')) {
      issues.push('CSS Grid may not render correctly');
    }

    // Check for image issues
    if (!clientSpec.images && html.includes('<img')) {
      issues.push('Images may be blocked by default');
    }

    // Check for width issues
    if (html.includes('width="700"') && clientSpec.maxWidth < 700) {
      issues.push('Content may be too wide for mobile view');
    }

    return issues;
  }

  /**
   * Calculate overall compatibility score
   */
  calculateCompatibilityScore(results) {
    const scores = Object.values(results).map(r => r.score || 0);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  /**
   * Check spam score for email content
   */
  async checkSpamScore(html, text, subject) {
    // Simulate spam checking with common spam indicators
    let score = 0;
    const issues = [];

    // Check subject line
    if (subject.includes('!!!') || subject.toUpperCase() === subject) {
      score += 2;
      issues.push('Excessive punctuation or all caps in subject');
    }

    // Check HTML content
    if (html.includes('URGENT') || html.includes('ACT NOW')) {
      score += 3;
      issues.push('Spam trigger words detected');
    }

    // Check for excessive links
    const linkCount = (html.match(/<a /g) || []).length;
    if (linkCount > 10) {
      score += 2;
      issues.push('Too many links detected');
    }

    // Check image to text ratio
    const imageCount = (html.match(/<img /g) || []).length;
    const textLength = text.length;
    if (imageCount > 5 && textLength < 200) {
      score += 2;
      issues.push('Poor text to image ratio');
    }

    return {
      score,
      rating: this.getSpamRating(score),
      issues,
      checkedAt: new Date()
    };
  }

  /**
   * Get spam rating based on score
   */
  getSpamRating(score) {
    if (score === 0) return 'excellent';
    if (score <= 2) return 'good';
    if (score <= 5) return 'fair';
    if (score <= 8) return 'poor';
    return 'high-risk';
  }

  /**
   * Check WCAG accessibility compliance
   */
  async checkAccessibility(html) {
    const issues = [];
    let score = 100;

    // Check for alt text on images
    const images = html.match(/<img[^>]*>/g) || [];
    const imagesWithoutAlt = images.filter(img => !img.includes('alt='));
    if (imagesWithoutAlt.length > 0) {
      issues.push(`${imagesWithoutAlt.length} images missing alt text`);
      score -= imagesWithoutAlt.length * 10;
    }

    // Check color contrast (simplified check)
    if (html.includes('color:#ffffff') && html.includes('background:#f0f0f0')) {
      issues.push('Potential low color contrast detected');
      score -= 15;
    }

    // Check for semantic HTML
    if (!html.includes('<h1') && !html.includes('<h2')) {
      issues.push('No heading structure detected');
      score -= 10;
    }

    // Check for table headers
    if (html.includes('<table') && !html.includes('<th')) {
      issues.push('Tables missing header cells');
      score -= 10;
    }

    // Check for link text
    const emptyLinks = (html.match(/<a[^>]*>[\s]*<\/a>/g) || []).length;
    if (emptyLinks > 0) {
      issues.push('Empty or unclear link text detected');
      score -= emptyLinks * 5;
    }

    return {
      score: Math.max(0, score),
      level: this.getAccessibilityLevel(score),
      issues,
      checkedAt: new Date()
    };
  }

  /**
   * Get WCAG compliance level
   */
  getAccessibilityLevel(score) {
    if (score >= 95) return 'AAA';
    if (score >= 85) return 'AA';
    if (score >= 70) return 'A';
    return 'Non-compliant';
  }

  /**
   * Monitor email performance metrics
   */
  async monitorPerformance(html) {
    const metrics = {
      htmlSize: new Blob([html]).size,
      imageCount: (html.match(/<img /g) || []).length,
      linkCount: (html.match(/<a /g) || []).length,
      cssInlineSize: this.calculateInlineCSSSize(html),
      estimatedLoadTime: 0,
      checkedAt: new Date()
    };

    // Estimate load time based on content
    metrics.estimatedLoadTime = (metrics.htmlSize / 1000) * 50 + (metrics.imageCount * 200);
    
    return {
      ...metrics,
      performance: this.getPerformanceRating(metrics),
      recommendations: this.getPerformanceRecommendations(metrics)
    };
  }

  /**
   * Calculate inline CSS size
   */
  calculateInlineCSSSize(html) {
    const styleMatches = html.match(/style="[^"]*"/g) || [];
    return styleMatches.join('').length;
  }

  /**
   * Get performance rating
   */
  getPerformanceRating(metrics) {
    if (metrics.estimatedLoadTime < 1000 && metrics.htmlSize < 50000) return 'excellent';
    if (metrics.estimatedLoadTime < 2000 && metrics.htmlSize < 100000) return 'good';
    if (metrics.estimatedLoadTime < 3000 && metrics.htmlSize < 150000) return 'fair';
    return 'poor';
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.htmlSize > 100000) {
      recommendations.push('Consider reducing HTML size (currently over 100KB)');
    }
    
    if (metrics.imageCount > 10) {
      recommendations.push('Consider reducing number of images');
    }
    
    if (metrics.cssInlineSize > 10000) {
      recommendations.push('Consider optimizing inline CSS');
    }
    
    if (metrics.estimatedLoadTime > 3000) {
      recommendations.push('Email may load slowly on mobile connections');
    }

    return recommendations;
  }

  /**
   * Run comprehensive template test suite
   */
  async runFullTestSuite(templateType) {
    const results = {
      templateType,
      testSuiteVersion: '1.0.0',
      runAt: new Date()
    };

    try {
      // Render template
      results.rendering = await this.renderTestTemplate(templateType);
      
      if (!results.rendering.success) {
        throw new Error(`Template rendering failed: ${results.rendering.error}`);
      }

      // Run all tests
      results.clientCompatibility = await this.testClientCompatibility(templateType);
      results.spamScore = await this.checkSpamScore(
        results.rendering.html,
        results.rendering.text,
        results.rendering.subject
      );
      results.accessibility = await this.checkAccessibility(results.rendering.html);
      results.performance = await this.monitorPerformance(results.rendering.html);

      // Calculate overall score
      results.overallScore = this.calculateOverallScore(results);
      results.success = true;

    } catch (error) {
      results.success = false;
      results.error = error.message;
    }

    return results;
  }

  /**
   * Calculate overall template quality score
   */
  calculateOverallScore(results) {
    const weights = {
      clientCompatibility: 0.3,
      spamScore: 0.25,
      accessibility: 0.25,
      performance: 0.2
    };

    let score = 0;
    
    if (results.clientCompatibility?.overallScore) {
      score += results.clientCompatibility.overallScore * weights.clientCompatibility;
    }
    
    // Invert spam score (lower is better)
    if (results.spamScore?.score !== undefined) {
      const spamScore = Math.max(0, 100 - (results.spamScore.score * 10));
      score += spamScore * weights.spamScore;
    }
    
    if (results.accessibility?.score) {
      score += results.accessibility.score * weights.accessibility;
    }
    
    if (results.performance?.performance) {
      const perfMap = { excellent: 100, good: 85, fair: 70, poor: 50 };
      score += (perfMap[results.performance.performance] || 50) * weights.performance;
    }

    return Math.round(score);
  }

  /**
   * Save test results to database
   */
  async saveTestResults(results) {
    try {
      const dbConnection = await getDbConnection();
      if (!dbConnection) {
        console.warn('Database not available, skipping result save');
        return { success: false, error: 'Database not available' };
      }
      
      const { db } = await dbConnection();
      
      await db.collection('email_test_results').insertOne({
        ...results,
        createdAt: new Date()
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get test history for a template type
   */
  async getTestHistory(templateType, limit = 10) {
    try {
      const dbConnection = await getDbConnection();
      if (!dbConnection) {
        console.warn('Database not available, returning empty history');
        return { success: true, results: [] };
      }
      
      const { db } = await dbConnection();
      
      const results = await db.collection('email_test_results')
        .find({ templateType })
        .sort({ runAt: -1 })
        .limit(limit)
        .toArray();

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default EmailTemplateTester;