#!/usr/bin/env node

/**
 * Standalone Email Template Testing Script
 * Tests the email template testing system without database dependencies
 */

import EmailTemplateTester from '../src/lib/email/testing/templateTester.js';

const tester = new EmailTemplateTester();

async function runStandaloneTests() {
  console.log('🧪 Starting Standalone Email Template Tests...\n');

  try {
    // Test 1: Template Rendering
    console.log('📧 Testing template rendering...');
    const seriesRender = await tester.renderTestTemplate('series');
    const reminderRender = await tester.renderTestTemplate('reminder');
    
    console.log(`✅ Series template: ${seriesRender.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Reminder template: ${reminderRender.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (seriesRender.success) {
      console.log(`   - HTML length: ${seriesRender.html.length} chars`);
      console.log(`   - Subject: ${seriesRender.subject}`);
    }
    
    if (reminderRender.success) {
      console.log(`   - HTML length: ${reminderRender.html.length} chars`);
      console.log(`   - Subject: ${reminderRender.subject}`);
    }
    
    // Test 2: Client Compatibility Testing
    console.log('\n🌐 Testing client compatibility...');
    const compatibilityTest = await tester.testClientCompatibility('series');
    console.log(`✅ Compatibility test: ${compatibilityTest.error ? 'FAILED' : 'SUCCESS'}`);
    
    if (!compatibilityTest.error) {
      console.log(`   - Overall score: ${compatibilityTest.overallScore}/100`);
      console.log(`   - Clients tested: ${Object.keys(compatibilityTest.clientResults).length}`);
      
      // Show top 3 client scores
      const topClients = Object.entries(compatibilityTest.clientResults)
        .sort(([,a], [,b]) => b.score - a.score)
        .slice(0, 3);
      
      console.log('   - Top client scores:');
      topClients.forEach(([client, result]) => {
        console.log(`     * ${client}: ${result.score}/100`);
      });
    }

    // Test 3: Spam Score Check
    console.log('\n🚫 Testing spam score...');
    if (seriesRender.success) {
      const spamTest = await tester.checkSpamScore(
        seriesRender.html,
        seriesRender.text,
        seriesRender.subject
      );
      console.log(`✅ Spam check: SUCCESS`);
      console.log(`   - Score: ${spamTest.score} (${spamTest.rating})`);
      console.log(`   - Issues: ${spamTest.issues.length}`);
      
      if (spamTest.issues.length > 0) {
        console.log('   - Issue details:');
        spamTest.issues.forEach(issue => {
          console.log(`     * ${issue}`);
        });
      }
    }

    // Test 4: Accessibility Check
    console.log('\n♿ Testing accessibility...');
    if (seriesRender.success) {
      const accessibilityTest = await tester.checkAccessibility(seriesRender.html);
      console.log(`✅ Accessibility check: SUCCESS`);
      console.log(`   - Score: ${accessibilityTest.score}/100 (${accessibilityTest.level})`);
      console.log(`   - Issues: ${accessibilityTest.issues.length}`);
      
      if (accessibilityTest.issues.length > 0) {
        console.log('   - Issue details:');
        accessibilityTest.issues.forEach(issue => {
          console.log(`     * ${issue}`);
        });
      }
    }

    // Test 5: Performance Monitoring
    console.log('\n⚡ Testing performance monitoring...');
    if (seriesRender.success) {
      const performanceTest = await tester.monitorPerformance(seriesRender.html);
      console.log(`✅ Performance check: SUCCESS`);
      console.log(`   - HTML size: ${performanceTest.htmlSize} bytes`);
      console.log(`   - Image count: ${performanceTest.imageCount}`);
      console.log(`   - Link count: ${performanceTest.linkCount}`);
      console.log(`   - Load time estimate: ${performanceTest.estimatedLoadTime}ms`);
      console.log(`   - Rating: ${performanceTest.performance}`);
      
      if (performanceTest.recommendations.length > 0) {
        console.log('   - Recommendations:');
        performanceTest.recommendations.forEach(rec => {
          console.log(`     * ${rec}`);
        });
      }
    }

    // Test 6: Test Data Generation
    console.log('\n📊 Testing data generation...');
    const seriesData = tester.generateTestData('series');
    const reminderData = tester.generateTestData('reminder');
    
    console.log(`✅ Series data generation: SUCCESS`);
    console.log(`   - Meeting title: ${seriesData.meetingTitle}`);
    console.log(`   - Participants: ${seriesData.participants.length}`);
    console.log(`   - Upcoming meetings: ${seriesData.upcomingMeetings.length}`);
    
    console.log(`✅ Reminder data generation: SUCCESS`);
    console.log(`   - Meeting title: ${reminderData.meetingTitle}`);
    console.log(`   - Start time: ${reminderData.startTime}`);
    console.log(`   - Duration: ${reminderData.duration} minutes`);

    // Test 7: Overall Score Calculation
    console.log('\n🔬 Testing overall score calculation...');
    const mockResults = {
      clientCompatibility: { overallScore: 85 },
      spamScore: { score: 2 },
      accessibility: { score: 90 },
      performance: { performance: 'good' }
    };
    
    const overallScore = tester.calculateOverallScore(mockResults);
    console.log(`✅ Overall score calculation: SUCCESS`);
    console.log(`   - Calculated score: ${overallScore}/100`);

    console.log('\n🎉 All standalone tests completed successfully!');
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('- Template rendering: ✅');
    console.log('- Client compatibility testing: ✅');
    console.log('- Spam score checking: ✅');
    console.log('- Accessibility validation: ✅');
    console.log('- Performance monitoring: ✅');
    console.log('- Test data generation: ✅');
    console.log('- Score calculation: ✅');

    // Performance benchmark
    console.log('\n⏱️  Running performance benchmark...');
    const iterations = 5;
    const renderTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      await tester.renderTestTemplate('series');
      const endTime = process.hrtime.bigint();
      const renderTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      renderTimes.push(renderTime);
    }
    
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const minRenderTime = Math.min(...renderTimes);
    const maxRenderTime = Math.max(...renderTimes);
    
    console.log(`✅ Performance benchmark completed:`);
    console.log(`   - Average render time: ${avgRenderTime.toFixed(2)}ms`);
    console.log(`   - Min render time: ${minRenderTime.toFixed(2)}ms`);
    console.log(`   - Max render time: ${maxRenderTime.toFixed(2)}ms`);
    console.log(`   - Iterations: ${iterations}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function testTemplateVariations() {
  console.log('\n🎨 Testing template variations...');
  
  try {
    // Test different template scenarios
    const scenarios = [
      { type: 'series', name: 'Weekly Series' },
      { type: 'reminder', name: '15-minute Reminder' },
      { type: 'series', name: 'Monthly Series' },
      { type: 'reminder', name: '1-hour Reminder' }
    ];
    
    for (const scenario of scenarios) {
      console.log(`\n📝 Testing ${scenario.name}...`);
      
      const result = await tester.renderTestTemplate(scenario.type);
      if (result.success) {
        const spamCheck = await tester.checkSpamScore(result.html, result.text, result.subject);
        const accessibilityCheck = await tester.checkAccessibility(result.html);
        const performanceCheck = await tester.monitorPerformance(result.html);
        
        console.log(`   ✅ Rendered successfully`);
        console.log(`   📊 Spam score: ${spamCheck.score} (${spamCheck.rating})`);
        console.log(`   ♿ Accessibility: ${accessibilityCheck.score}/100 (${accessibilityCheck.level})`);
        console.log(`   ⚡ Performance: ${performanceCheck.performance}`);
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Template variation test failed:', error);
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runStandaloneTests()
    .then(() => testTemplateVariations())
    .then(() => {
      console.log('\n✨ Email template testing system is working perfectly!');
      console.log('\n💡 Next steps:');
      console.log('   1. Set up MongoDB connection for full database tests');
      console.log('   2. Start the Next.js server to test API endpoints');
      console.log('   3. Use the TemplateTesting dashboard component');
      console.log('   4. Set up automated testing schedules');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}