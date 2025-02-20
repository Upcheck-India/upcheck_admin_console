const nodemailer = require('nodemailer');

// Create reusable transporter object
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service provider (e.g., Zoho, Outlook, etc.)
  auth: {
    user: 'upcheck.team@gmail.com', // Your email
    pass: 'znko yoeq uvbc anvy',   // Your email password or app password
  },
});

// Email options
const mailOptions = {
  from: 'upcheck.team@gmail.com', // Sender address
  to: 'robin@upcheck.in', // Recipient's email
  subject: 'Welcome to Upcheck!', // Subject line
  html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f0f4f8;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #0288d1 0%, #00897b 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .email-header::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at top right, rgba(255,255,255,0.2) 0%, transparent 60%);
    }
    .email-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .email-body {
      padding: 32px;
    }
    .email-body h2 {
      font-size: 24px;
      color: #1a237e;
      margin-top: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .email-body p {
      font-size: 16px;
      color: #37474f;
      line-height: 1.6;
      margin: 16px 0;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 24px 0;
    }
    .feature-item {
      background: linear-gradient(135deg, #e3f2fd 0%, #e0f2f1 100%);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid rgba(0, 137, 123, 0.1);
    }
    .feature-item h4 {
      color: #0288d1;
      margin: 0 0 8px 0;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .feature-item p {
      margin: 0;
      font-size: 14px;
      color: #546e7a;
      line-height: 1.5;
    }
    .welcome-box {
      background: linear-gradient(135deg, #e1f5fe 0%, #e0f2f1 100%);
      border-left: 4px solid #0288d1;
      padding: 20px;
      margin: 24px 0;
      border-radius: 8px;
      position: relative;
    }
    .credentials-container {
      background: linear-gradient(145deg, #ffffff 0%, #f8faff 100%);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      border: 1px solid #e0e0e0;
      box-shadow: 0 2px 12px rgba(0, 137, 123, 0.08);
    }
    .security-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #fff4e5;
      color: #b45309;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .security-icon {
      color: #b45309;
    }
    .credential-item {
      display: flex;
      align-items: center;
      margin: 16px 0;
      gap: 16px;
      background-color: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .credential-label {
      min-width: 100px;
      color: #1a237e;
      font-weight: 600;
    }
    .credential-value {
      font-family: 'Consolas', monospace;
      background-color: #f8faff;
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
      color: #0288d1;
      font-weight: 500;
    }
    .security-notes {
      background-color: #f8faff;
      border-left: 4px solid #0288d1;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .security-notes ul {
      margin: 0;
      padding-left: 20px;
    }
    .security-notes li {
      color: #37474f;
      margin: 8px 0;
      line-height: 1.5;
    }
    .security-notes strong {
      color: #0288d1;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      margin-top: 24px;
      font-size: 16px;
      color: #ffffff;
      background: linear-gradient(135deg, #0288d1 0%, #00897b 100%);
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 137, 123, 0.2);
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 137, 123, 0.3);
    }
    .support-info {
      background-color: #f8faff;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .support-info h4 {
      color: #1a237e;
      margin: 0 0 12px 0;
    }
    .support-info ul {
      list-style: none;
      padding: 0;
      margin: 12px 0;
    }
    .support-info li {
      margin: 8px 0;
      color: #37474f;
    }
    .support-info a {
      color: #0288d1;
      text-decoration: none;
      font-weight: 500;
    }
    .support-info a:hover {
      text-decoration: underline;
    }
    .email-footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
    }
    .email-footer p {
      font-size: 14px;
      color: #607d8b;
      margin: 8px 0;
    }
    .email-footer a {
      color: #0288d1;
      text-decoration: none;
    }
    .email-footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Welcome to Upcheck! 🎉</h1>
    </div>
    
    <div class="email-body">
      <h2>Your Journey Begins Here</h2>
      
      <p>Hi Nithishkumar,</p>
      
      <div class="welcome-box">
        <p>Great news! Your Upcheck console is now ready for action. We've set up everything you need to get started!</p>
      </div>

      <h3>Your Console Features</h3>
      <div class="feature-grid">
        <div class="feature-item">
          <h4>📑 Content Management</h4>
          <p>Create, edit, and organize content for the resource page. Manage documentation, guides, and knowledge base articles with version control.</p>
        </div>
        <div class="feature-item">
          <h4>💬 Team Communication</h4>
          <p>Send emails and private messages directly through the console. Enjoy secure, encrypted communication channels with team members.</p>
        </div>
        <div class="feature-item">
          <h4>📋 Task Tracking</h4>
          <p>Create, assign, and track tasks with detailed progress monitoring. Set priorities, deadlines, and receive automated notifications.</p>
        </div>
        <div class="feature-item">
          <h4>📚 Documentation Hub</h4>
          <p>Central repository for all team documents, notes, and resources. Search, organize, and never lose important information again.</p>
        </div>
      </div>

      <div class="credentials-container">
        <h3>Your Login Credentials</h3>
        <div class="security-alert">
          <svg class="security-icon" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.8 1.1 2.8 2.5V11c.6 0 1.2.6 1.2 1.2v3.5c0 .7-.6 1.3-1.2 1.3H9.2c-.6 0-1.2-.6-1.2-1.2v-3.5c0-.7.6-1.3 1.2-1.3V9.5C9.2 8.1 10.6 7 12 7zm0 1.2c-.8 0-1.5.5-1.5 1.3V11h3v-1.5c0-.8-.7-1.3-1.5-1.3z"/>
          </svg>
          <span>Important Security Information</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Username:</span>
          <span class="credential-value">Nithishkumar B</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Password:</span>
          <span class="credential-value">Hockey@2025</span>
        </div>
        
        <div class="security-notes">
          <ul>
            <li><strong>Password Change Required:</strong> For security purposes, please change your password upon first login</li>
            <li><strong>Session Duration:</strong> Login sessions automatically expire after 2 hours</li>
            <li><strong>Role-Based Access:</strong> Your access is strictly controlled based on your assigned role</li>
          </ul>
        </div>
      </div>

      <p>Ready to get started? Access your console now:</p>
      <a href="https://console.upcheck.in" class="button">Launch Upcheck Console</a>

      <div class="support-info">
        <h4>Need Support?</h4>
        <p>Contact us at:</p>
        <ul>
          <li>General Support: <a href="mailto:care@upcheck.in">care@upcheck.in</a></li>
          <li>Technical Support: <a href="mailto:admin@upcheck.in">admin@upcheck.in</a></li>
        </ul>
      </div>
    </div>

    <div class="email-footer">
      <p>Welcome to the team!</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
  </div>
</body>
</html>`,
};

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error sending email:', error);
  } else {
    console.log('Email sent successfully:', info.response);
  }
});