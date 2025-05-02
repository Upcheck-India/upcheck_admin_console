const nodemailer = require('nodemailer');
const path = require('path');

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
  to: 'punithakumarkebmhss@gmail.com', // Recipient's email
  subject: 'Welcome to Upcheck India!', // Subject line
  html: `<!DOCTYPE html>
<html lang="en">
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
    .welcome-box {
      background: linear-gradient(135deg, #e1f5fe 0%, #e0f2f1 100%);
      border-left: 4px solid #0288d1;
      padding: 20px;
      margin: 24px 0;
      border-radius: 8px;
      position: relative;
    }
    .internship-details {
      background: linear-gradient(145deg, #ffffff 0%, #f8faff 100%);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      border: 1px solid #e0e0e0;
      box-shadow: 0 2px 12px rgba(0, 137, 123, 0.08);
    }
    .detail-item {
      display: flex;
      align-items: center;
      margin: 16px 0;
      gap: 16px;
      background-color: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .detail-label {
      min-width: 120px;
      color: #1a237e;
      font-weight: 600;
    }
    .detail-value {
      color: #37474f;
      font-weight: 500;
    }
    .notes {
      background-color: #f8faff;
      border-left: 4px solid #0288d1;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .notes ul {
      margin: 0;
      padding-left: 20px;
    }
    .notes li {
      color: #37474f;
      margin: 8px 0;
      line-height: 1.5;
    }
    .notes strong {
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
    .feature-item {
      background: linear-gradient(135deg, #e3f2fd 0%, #e0f2f1 100%);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid rgba(0, 137, 123, 0.1);
      margin-bottom: 16px;
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
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Congratulations! 🎉</h1>
    </div>
    
    <div class="email-body">
      <h2>Your Upcheck Journey Begins Here</h2>
      
      <p>Hi Robin,</p>
      
      <div class="welcome-box">
        <p>We are excited to offer you the position of <strong>Junior Content Associate Intern</strong> at <strong>Upcheck India Pvt Ltd</strong>. Please find your official offer letter attached to this email. Your skills and enthusiasm make you a perfect fit for our team!</p>
      </div>

      <div class="internship-details">
        <h3>Internship Details</h3>
        <div class="detail-item">
          <span class="detail-label">Position:</span>
          <span class="detail-value">Junior Content Associate Intern</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Duration:</span>
          <span class="detail-value">1 month</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Work Type:</span>
          <span class="detail-value">Remote</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Compensation:</span>
          <span class="detail-value">Unpaid, with potential for stipend based on performance</span>
        </div>
        
        <div class="notes">
          <ul>
            <li><strong>Performance Review:</strong> Your work will be evaluated throughout the internship period</li>
            <li><strong>Full-time Opportunity:</strong> Outstanding performance may lead to a full-time position offer</li>
            <li><strong>Onboarding Test:</strong> Required before joining to assess your skills and readiness</li>
          </ul>
        </div>
      </div>

      <h3>What You'll Be Working On</h3>
      <div class="feature-item">
        <h4>📑 Content Creation</h4>
        <p>Develop engaging content for our digital platforms, including blog posts, social media, and resource pages.</p>
      </div>
      <div class="feature-item">
        <h4>📚 Documentation</h4>
        <p>Assist in creating user guides, tutorials, and knowledge base articles for our products and services.</p>
      </div>
      <div class="feature-item">
        <h4>🔍 Content Research</h4>
        <p>Conduct research on industry trends and topics to support our content strategy and development.</p>
      </div>

      <p>Before your joining date, you are required to complete a short formal test to confirm your onboarding process</p>
      <p>You will receive the credentials to access the test portal within 2 to 3 working days, If not please reach out to us.</p>
      <div style="text-align: center;">
        <a href="https://console.upcheck.in/recruitment" class="button">Complete Onboarding Test</a>
      </div>

      <div class="support-info">
        <h4>Questions or Concerns?</h4>
        <p>Feel free to reach out to us:</p>
        <ul>
          <li>HR Department: <a href="mailto:hr@upcheck.in">hr@upcheck.in</a></li>
          <li>Admin: <a href="mailto:admin@upcheck.in">admin@upcheck.in</a></li>
        </ul>
      </div>
    </div>

    <div class="email-footer">
      <p>We look forward to welcoming you to the Upcheck India team!</p>
      <p>Best regards,<br>Robinkumar J<br>Chief HR<br>Upcheck India Pvt Ltd</p>
    </div>
  </div>
</body>
</html>`,
  // Add the attachment here
  attachments: [
    {
        filename: 'Upcheck_Offer_Letter.pdf', // Name that will appear in the email
        path: 'C:\\Users\\robin\\Downloads\\Documents\\punith-offer.pdf', // Path to your PDF file
        contentType: 'application/pdf' // Specify MIME type
      }
  ]
};

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error sending email:', error);
  } else {
    console.log('Email sent successfully:', info.response);
  }
});