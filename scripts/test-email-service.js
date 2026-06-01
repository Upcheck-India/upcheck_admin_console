/**
 * Test script for email service
 * Run with: node scripts/test-email-service.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Dynamic import for ES modules
const testEmailService = async () => {
  console.log('='.repeat(60));
  console.log('Email Service Test');
  console.log('='.repeat(60));

  try {
    // Import the email service
    const emailService = await import('../src/lib/emailService.js');

    console.log('\n📋 Email Configuration:');
    const config = emailService.getEmailConfig();
    console.log('  - Brevo Available:', config.brevoAvailable);
    console.log('  - Notifications Enabled:', config.notificationsEnabled);
    console.log('  - Sender:', config.sender);
    console.log('  - Admin Emails:', config.adminEmails);

    // Check if Brevo API key is configured
    if (!process.env.BREVO_API_KEY) {
      console.log('\n⚠️  Warning: BREVO_API_KEY not found in environment');
      console.log('  The service will use nodemailer fallback (Gmail SMTP)');
    } else {
      console.log('\n✅ BREVO_API_KEY found');
      console.log('  Primary: Brevo API');
      console.log('  Fallback: Nodemailer SMTP');
    }

    // Ask for test email recipient
    const testEmail = process.argv[2] || process.env.TEST_EMAIL_RECIPIENT;

    if (!testEmail) {
      console.log('\n❌ No test email recipient provided');
      console.log('  Usage: node scripts/test-email-service.js your-email@example.com');
      console.log('  Or set TEST_EMAIL_RECIPIENT in .env.local');
      return;
    }

    console.log('\n📧 Sending test email to:', testEmail);

    const result = await emailService.testEmailService(testEmail);

    if (result.success) {
      console.log('\n✅ Email sent successfully!');
      console.log('  - Provider:', result.provider);
      console.log('  - Message ID:', result.messageId);
      console.log('  - Type:', result.type);
      console.log('  - Recipients:', result.recipients);
    } else {
      console.log('\n❌ Email sending failed');
      console.log('  - Reason:', result.reason || result.error);
    }

    // Test templated email
    console.log('\n📧 Testing templated email (WELCOME_USER)');

    const templateResult = await emailService.sendTemplatedEmail(
      emailService.EMAIL_TYPES.WELCOME_USER,
      {
        name: 'Test User',
        username: 'testuser',
        email: testEmail,
        password: 'TempPass123!',
        role: 'Member',
        department: 'Development'
      },
      { to: testEmail }
    );

    if (templateResult.success) {
      console.log('\n✅ Templated email sent successfully!');
      console.log('  - Provider:', templateResult.provider);
      console.log('  - Message ID:', templateResult.messageId);
    } else {
      console.log('\n❌ Templated email failed');
      console.log('  - Error:', templateResult.error || templateResult.reason);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  }
};

testEmailService();