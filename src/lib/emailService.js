/**
 * Unified Email Service for Upcheck Admin Console
 * Primary: Brevo (formerly Sendinblue)
 * Fallback: Nodemailer SMTP
 */

import nodemailer from 'nodemailer';

// Brevo SDK imports (will be available after npm install)
let BrevoApi;
try {
  // Dynamic import for Brevo SDK
  BrevoApi = await import('@getbrevo/brevo').then(m => m.default || m);
} catch (e) {
  console.warn('Brevo SDK not available, will use nodemailer fallback only:', e.message);
}

// Configuration from environment
const config = {
  // Brevo (Primary)
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'upcheck.team@upcheck.in',
    senderName: process.env.BREVO_SENDER_NAME || 'Upcheck Admin',
  },
  // SMTP Fallback (Nodemailer)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || process.env.EMAIL_USER || 'upcheck.team@gmail.com',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || 'znko yoeq uvbc anvy',
  },
  // General settings
  notificationsEnabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(e => e.trim()),
};

// Email priority levels
export const EMAIL_PRIORITY = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
};

// Email types for tracking and templating
export const EMAIL_TYPES = {
  WELCOME_USER: 'welcome_user',
  PASSWORD_CHANGE: 'password_change',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  TEAM_CREATED: 'team_created',
  TEAM_MEMBER_ADDED: 'team_member_added',
  TEAM_MEMBER_REMOVED: 'team_member_removed',
  EXTERNAL_USER_APPROVED: 'external_user_approved',
  EXTERNAL_USER_REJECTED: 'external_user_rejected',
  EXTERNAL_USER_EXPIRING: 'external_user_expiring',
  LOGIN_ALERT: 'login_alert',
  MEETING_INVITE: 'meeting_invite',
  MEETING_REMINDER: 'meeting_reminder',
  MEETING_CANCELLED: 'meeting_cancelled',
  SYSTEM_ALERT: 'system_alert',
  VERIFICATION_CODE: 'verification_code',
  CUSTOM: 'custom'
};

// Nodemailer transporter for fallback
const createNodemailerTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
};

// Brevo API client instance
let brevoClient = null;
let brevoTransactionalEmailsApi = null;

const initializeBrevoClient = () => {
  if (!config.brevo.apiKey) {
    console.warn('Brevo API key not configured, using nodemailer fallback');
    return false;
  }

  try {
    if (BrevoApi) {
      brevoClient = new BrevoApi({
        apiKey: config.brevo.apiKey,
      });

      // Get the transactional emails API
      if (BrevoApi.TransactionalEmailsApi) {
        brevoTransactionalEmailsApi = new BrevoApi.TransactionalEmailsApi();
        brevoTransactionalEmailsApi.setApiKey(BrevoApi.TransactionalEmailsApiApiKeys.apiKey, config.brevo.apiKey);
      }

      console.log('Brevo client initialized successfully');
      return true;
    }
  } catch (error) {
    console.error('Failed to initialize Brevo client:', error.message);
    return false;
  }

  return false;
};

// Try to initialize Brevo on module load
const brevoAvailable = initializeBrevoClient();

/**
 * Send email using Brevo (primary) with nodemailer fallback
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email(s), can be array or comma-separated
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} options.text - Plain text body (optional)
 * @param {string} options.type - Email type for tracking
 * @param {string} options.priority - Email priority (high, normal, low)
 * @param {Array} options.attachments - Attachments array
 * @param {Object} options.replyTo - Reply-to configuration
 * @returns {Promise<Object>} - Send result
 */
export const sendEmail = async (options) => {
  const {
    to,
    subject,
    html,
    text,
    type = EMAIL_TYPES.CUSTOM,
    priority = EMAIL_PRIORITY.NORMAL,
    attachments = [],
    replyTo = null,
    cc = [],
    bcc = []
  } = options;

  // Check if notifications are enabled
  if (!config.notificationsEnabled) {
    console.log(`Notifications disabled, skipping email: ${type} to ${to}`);
    return { success: false, reason: 'notifications_disabled' };
  }

  // Validate required fields
  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, html');
  }

  // Normalize recipients
  const recipients = Array.isArray(to) ? to : to.split(',').map(e => e.trim()).filter(Boolean);
  const ccRecipients = Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim()).filter(Boolean);
  const bccRecipients = Array.isArray(bcc) ? bcc : bcc.split(',').map(e => e.trim()).filter(Boolean);

  if (recipients.length === 0) {
    throw new Error('No valid recipients provided');
  }

  // Build sender info
  const sender = {
    email: config.brevo.senderEmail,
    name: config.brevo.senderName
  };

  // Log attempt
  console.log(`Sending email [${type}] to ${recipients.join(', ')} via ${brevoAvailable ? 'Brevo' : 'Nodemailer'}`);

  // Try Brevo first
  if (brevoAvailable && brevoTransactionalEmailsApi) {
    try {
      const brevoResult = await sendWithBrevo({
        recipients,
        ccRecipients,
        bccRecipients,
        subject,
        html,
        text,
        sender,
        attachments,
        replyTo,
        priority,
        type
      });

      if (brevoResult.success) {
        return brevoResult;
      }

      console.warn('Brevo send failed, falling back to nodemailer:', brevoResult.error);
    } catch (brevoError) {
      console.error('Brevo error, falling back to nodemailer:', brevoError.message);
    }
  }

  // Fallback to nodemailer
  return sendWithNodemailer({
    recipients,
    ccRecipients,
    bccRecipients,
    subject,
    html,
    text,
    sender,
    attachments,
    replyTo,
    priority,
    type
  });
};

/**
 * Send email using Brevo API
 */
const sendWithBrevo = async (options) => {
  const {
    recipients,
    ccRecipients,
    bccRecipients,
    subject,
    html,
    text,
    sender,
    attachments,
    replyTo,
    priority,
    type
  } = options;

  try {
    // Build Brevo email payload
    const emailData = {
      sender,
      to: recipients.map(email => ({ email })),
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text
      tags: [type],
      priority: priority === EMAIL_PRIORITY.HIGH ? 1 : priority === EMAIL_PRIORITY.LOW ? 3 : 2,
    };

    // Add CC if provided
    if (ccRecipients.length > 0) {
      emailData.cc = ccRecipients.map(email => ({ email }));
    }

    // Add BCC if provided
    if (bccRecipients.length > 0) {
      emailData.bcc = bccRecipients.map(email => ({ email }));
    }

    // Add reply-to if provided
    if (replyTo) {
      emailData.replyTo = { email: replyTo.email, name: replyTo.name };
    }

    // Add attachments if provided
    if (attachments.length > 0) {
      emailData.attachment = attachments.map(att => ({
        name: att.filename || att.name,
        content: att.content ? (Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content) : undefined,
        url: att.url || undefined,
        contentType: att.contentType || att.type
      }));
    }

    // Send via Brevo API
    const response = await brevoTransactionalEmailsApi.sendTransacEmail(emailData);

    console.log(`✅ Email sent via Brevo: ${response.messageId || 'success'}`);

    return {
      success: true,
      messageId: response.messageId,
      provider: 'brevo',
      type,
      recipients
    };
  } catch (error) {
    console.error('Brevo send error:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'brevo'
    };
  }
};

/**
 * Send email using nodemailer (fallback)
 */
const sendWithNodemailer = async (options) => {
  const {
    recipients,
    ccRecipients,
    bccRecipients,
    subject,
    html,
    text,
    sender,
    attachments,
    replyTo,
    priority,
    type
  } = options;

  const transporter = createNodemailerTransporter();

  try {
    const mailOptions = {
      from: `${sender.name} <${sender.email}>`,
      to: recipients.join(','),
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
      priority: priority === EMAIL_PRIORITY.HIGH ? 'high' : 'normal',
    };

    // Add CC if provided
    if (ccRecipients.length > 0) {
      mailOptions.cc = ccRecipients.join(',');
    }

    // Add BCC if provided
    if (bccRecipients.length > 0) {
      mailOptions.bcc = bccRecipients.join(',');
    }

    // Add reply-to if provided
    if (replyTo) {
      mailOptions.replyTo = `${replyTo.name || ''} <${replyTo.email}>`;
    }

    // Add attachments if provided
    if (attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.filename || att.name,
        content: att.content,
        contentType: att.contentType || att.type
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent via Nodemailer: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      provider: 'nodemailer',
      type,
      recipients
    };
  } catch (error) {
    console.error('Nodemailer send error:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send email to admin users
 * @param {Object} options - Email options (subject, html, text, type)
 */
export const sendAdminEmail = async (options) => {
  if (config.adminEmails.length === 0) {
    console.warn('No admin emails configured');
    return { success: false, reason: 'no_admin_emails' };
  }

  return sendEmail({
    ...options,
    to: config.adminEmails,
    priority: EMAIL_PRIORITY.HIGH
  });
};

/**
 * Send templated email using a template function
 * @param {string} type - Email type
 * @param {Object} data - Template data
 * @param {Object} options - Additional options (to, attachments, etc.)
 */
export const sendTemplatedEmail = async (type, data, options = {}) => {
  // Import templates dynamically
  const templates = await getEmailTemplates();

  const template = templates[type];
  if (!template) {
    console.warn(`No template found for type: ${type}, using default`);
    return sendEmail({
      ...options,
      subject: options.subject || `Upcheck Notification: ${type}`,
      html: options.html || `<p>${JSON.stringify(data)}</p>`,
      type
    });
  }

  const { subject, html, text } = template(data);

  return sendEmail({
    ...options,
    subject,
    html,
    text,
    type
  });
};

/**
 * Get email templates (lazy loaded)
 */
const emailTemplates = {};

const getEmailTemplates = async () => {
  if (Object.keys(emailTemplates).length === 0) {
    // Load templates from files
    try {
      // Welcome user template
      emailTemplates[EMAIL_TYPES.WELCOME_USER] = (data) => ({
        subject: `Welcome to Upcheck Admin Console`,
        html: generateWelcomeEmail(data),
        text: `Welcome ${data.name}! Your account has been created. Username: ${data.username}`
      });

      // Password change template
      emailTemplates[EMAIL_TYPES.PASSWORD_CHANGE] = (data) => ({
        subject: `Password Changed - Upcheck Admin Console`,
        html: generatePasswordChangeEmail(data),
        text: `Your password has been changed. If you didn't make this change, contact admin immediately.`
      });

      // Team created template
      emailTemplates[EMAIL_TYPES.TEAM_CREATED] = (data) => ({
        subject: `New Team Created: ${data.teamName}`,
        html: generateTeamCreatedEmail(data),
        text: `Team "${data.teamName}" has been created. You are the team lead.`
      });

      // Team member added template
      emailTemplates[EMAIL_TYPES.TEAM_MEMBER_ADDED] = (data) => ({
        subject: `Added to Team: ${data.teamName}`,
        html: generateTeamMemberAddedEmail(data),
        text: `You have been added to team "${data.teamName}" by ${data.addedBy}.`
      });

      // External user approved template
      emailTemplates[EMAIL_TYPES.EXTERNAL_USER_APPROVED] = (data) => ({
        subject: `Access Approved - Upcheck Data Room`,
        html: generateExternalUserApprovedEmail(data),
        text: `Your access to Upcheck Data Room has been approved. You can now login.`
      });

      // External user rejected template
      emailTemplates[EMAIL_TYPES.EXTERNAL_USER_REJECTED] = (data) => ({
        subject: `Access Request Update - Upcheck Data Room`,
        html: generateExternalUserRejectedEmail(data),
        text: `Your access request to Upcheck Data Room has been reviewed. Unfortunately, it was not approved.`
      });

      // Login alert template
      emailTemplates[EMAIL_TYPES.LOGIN_ALERT] = (data) => ({
        subject: `Login Alert - Upcheck Admin Console`,
        html: generateLoginAlertEmail(data),
        text: `New login detected on your account at ${data.timestamp} from ${data.ip || 'unknown location'}.`
      });

      // Verification code template
      emailTemplates[EMAIL_TYPES.VERIFICATION_CODE] = (data) => ({
        subject: `Verification Code - Upcheck`,
        html: generateVerificationCodeEmail(data),
        text: `Your verification code is: ${data.code}. It expires in ${data.expiryMinutes || 15} minutes.`
      });

      // System alert template
      emailTemplates[EMAIL_TYPES.SYSTEM_ALERT] = (data) => ({
        subject: `🚨 System Alert: ${data.title}`,
        html: generateSystemAlertEmail(data),
        text: data.message
      });

    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  }

  return emailTemplates;
};

// ============================================
// EMAIL TEMPLATE GENERATORS
// ============================================

const generateWelcomeEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .credentials { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Upcheck!</h1>
      <p>Your admin console account is ready</p>
    </div>
    <div class="content">
      <p>Hello ${data.name || data.username},</p>
      <p>Your account has been created on the Upcheck Admin Console. Here are your login credentials:</p>
      <div class="credentials">
        <p><strong>Username:</strong> ${data.username}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        ${data.password ? `<p><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${data.password}</code></p>
        <p style="font-size: 12px; color: #ef4444;">⚠️ Please change your password after your first login.</p>` : ''}
        <p><strong>Role:</strong> ${data.role}</p>
        ${data.department ? `<p><strong>Department:</strong> ${data.department}</p>` : ''}
      </div>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://erp.upcheck.in'}/login" class="button">Login Now</a></p>
      <p>If you have any questions, please contact your administrator.</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message, please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generatePasswordChangeEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Password Changed</h1>
    </div>
    <div class="content">
      <p>Hello ${data.name || data.username},</p>
      <p>Your password for the Upcheck Admin Console has been changed.</p>
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> If you did not make this change, please contact your administrator immediately and secure your account.
      </div>
      <p><strong>Changed at:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString()}</p>
      ${data.changedBy ? `<p><strong>Changed by:</strong> ${data.changedBy}</p>` : ''}
      <p>If you made this change yourself, no further action is required.</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateTeamCreatedEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .team-card { background: white; border: 2px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👥 New Team Created</h1>
    </div>
    <div class="content">
      <p>Hello ${data.leadName || 'Team Lead'},</p>
      <p>A new team has been created and you have been assigned as the team lead.</p>
      <div class="team-card">
        <p><strong>Team Name:</strong> ${data.teamName}</p>
        ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
        <p><strong>Created by:</strong> ${data.createdBy || 'Admin'}</p>
        <p><strong>Created at:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString()}</p>
      </div>
      <p>As the team lead, you can manage team members and settings from the User Management page.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://erp.upcheck.in'}/user_management" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Manage Team</a></p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateTeamMemberAddedEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👥 Added to Team</h1>
    </div>
    <div class="content">
      <p>Hello ${data.memberName || 'Team Member'},</p>
      <p>You have been added to the team <strong>"${data.teamName}"</strong> by ${data.addedBy || 'an administrator'}.</p>
      ${data.role ? `<p><strong>Your role in the team:</strong> ${data.role}</p>` : ''}
      <p>You can view your team details in the User Management page under the Teams tab.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://erp.upcheck.in'}/user_management" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Team</a></p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateExternalUserApprovedEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .credentials { background: white; border: 2px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Access Approved!</h1>
      <p>Welcome to Upcheck Data Room</p>
    </div>
    <div class="content">
      <p>Hello ${data.name},</p>
      <p>Great news! Your access request to the Upcheck Data Room has been <strong>approved</strong>.</p>
      <p><strong>Approved role:</strong> ${data.role}</p>
      ${data.expiresAt ? `<p><strong>Access expires:</strong> ${new Date(data.expiresAt).toLocaleDateString()}</p>
      <p style="color: #f59e0b;">⚠️ Your access is temporary and will expire on the date above.</p>` : ''}
      <p>You can now login using your registered email address.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://erp.upcheck.in'}/dataroom/external/login" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Login Now</a></p>
      <p>If you have any questions, please contact the person who invited you.</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateExternalUserRejectedEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6b7280; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Access Request Update</h1>
    </div>
    <div class="content">
      <p>Hello ${data.name},</p>
      <p>Thank you for your interest in the Upcheck Data Room.</p>
      <p>After review, we regret to inform you that your access request was not approved at this time.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
      <p>If you believe this was an error or would like to reapply, please contact the administrator.</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateLoginAlertEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Login Alert</h1>
    </div>
    <div class="content">
      <p>Hello ${data.name || data.username},</p>
      <p>A new login was detected on your Upcheck Admin Console account.</p>
      <div class="info-box">
        <p><strong>Time:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString()}</p>
        ${data.ip ? `<p><strong>IP Address:</strong> ${data.ip}</p>` : ''}
        ${data.device ? `<p><strong>Device:</strong> ${data.device}</p>` : ''}
        ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
      </div>
      <p>If this was you, no action is needed.</p>
      <p style="color: #dc2626;">⚠️ If you did not make this login, please secure your account immediately by changing your password and contacting your administrator.</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateVerificationCodeEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
    .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verification Code</h1>
      <p>${data.service || 'Upcheck'}</p>
    </div>
    <div class="content">
      <p>Hello ${data.name || 'there'},</p>
      <p>Please use the verification code below:</p>
      <div class="code-box">
        <div class="code">${data.code}</div>
      </div>
      <div class="warning">
        <strong>⚠️ Important:</strong> This code will expire in ${data.expiryMinutes || 15} minutes.
      </div>
      <p>If you didn't request this code, please ignore this email.</p>
      <p>Best regards,<br>Upcheck Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message, please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const generateSystemAlertEmail = (data) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${data.severity === 'critical' ? '#dc2626' : data.severity === 'high' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .alert-box { background: white; border: 2px solid ${data.severity === 'critical' ? '#dc2626' : '#f59e0b'}; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 System Alert</h1>
      <p>${data.severity || 'Alert'} - ${data.title}</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <p><strong>Alert Type:</strong> ${data.type || 'System'}</p>
        <p><strong>Timestamp:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString()}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message}</p>
        ${data.actionRequired ? `<p style="color: #dc2626;"><strong>Action Required:</strong> ${data.actionRequired}</p>` : ''}
      </div>
      <p>Please check the admin dashboard for more details.</p>
      <p>Best regards,<br>Upcheck System</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Upcheck. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Export configuration for external access
export const getEmailConfig = () => ({
  brevoAvailable,
  notificationsEnabled: config.notificationsEnabled,
  adminEmails: config.adminEmails,
  sender: {
    email: config.brevo.senderEmail,
    name: config.brevo.senderName
  }
});

// Test email function
export const testEmailService = async (toEmail) => {
  return sendEmail({
    to: toEmail,
    subject: 'Test Email from Upcheck Admin Console',
    html: `
      <h2>Email Service Test</h2>
      <p>This is a test email to verify the email service is working correctly.</p>
      <p><strong>Provider:</strong> ${brevoAvailable ? 'Brevo (Primary)' : 'Nodemailer (Fallback)'}</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    `,
    type: EMAIL_TYPES.CUSTOM,
    priority: EMAIL_PRIORITY.NORMAL
  });
};

export default {
  sendEmail,
  sendAdminEmail,
  sendTemplatedEmail,
  testEmailService,
  EMAIL_TYPES,
  EMAIL_PRIORITY,
  getEmailConfig
};