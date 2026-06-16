import nodemailer from 'nodemailer';
import * as ics from 'ics';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'upcheck.team@gmail.com',
    pass: process.env.EMAIL_PASS || 'znko yoeq uvbc anvy',
  },
});

const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
};

const formatTime = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone: 'Asia/Kolkata',
    timeZoneName: 'short',
  }).format(new Date(date));
};

const formatShortDate = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
};

const getDayOfMonth = (date) => {
  return new Date(date).getDate();
};

const getMonthShort = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date)).toUpperCase();
};

/**
 * Sends a styled invitation email with improved design.
 */
export const sendEmail = async (to, subject, options) => {
  const { host, event, participants = [], teams = [], notes, openPixelUrl, trackedJoinUrl, ackUrl } = options;
  const joinLink = event.joinUrl || event.zoomMeetingUrl;
  const providerLabel = event.provider === 'google_meet' ? 'Google Meet' : 'Zoom';
  const providerColor = event.provider === 'google_meet' ? '#0F9D58' : '#2D8CFF';
  const providerIcon = event.provider === 'google_meet' ? '📹' : '🎥';

  const startDate = new Date(event.startTime);
  const eventData = {
    title: event.title,
    description: `${event.description || ''}\n\nJoin: ${joinLink || ''}`.trim(),
    start: [
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + 1,
      startDate.getUTCDate(),
      startDate.getUTCHours(),
      startDate.getUTCMinutes(),
    ],
    startInputType: 'utc',
    duration: { minutes: Number(event.duration) || 0 },
    status: 'CONFIRMED',
    organizer: { name: 'Upcheck Admin', email: host },
    url: joinLink,
    location: providerLabel,
    alarms: [
      {
        action: 'display',
        description: 'Event reminder',
        trigger: { minutes: 15, before: true },
      },
    ],
    attendees: (participants || []).map(p => ({ email: p, rsvp: true, partstat: 'NEEDS-ACTION' })),
  };

  const { error: icsError, value: icsContent } = ics.createEvent(eventData);
  if (icsError) {
    console.error('Failed generating ICS:', icsError);
  }
  const safeTitle = (event.title || 'event').replace(/[^a-zA-Z0-9]/g, '_');

  const formattedDate = formatDate(event.startTime);
  const formattedTime = formatTime(event.startTime);
  const dayOfMonth = getDayOfMonth(event.startTime);
  const monthShort = getMonthShort(event.startTime);

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Meeting Invitation</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
      </style>
      <![endif]-->
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          margin: 0; 
          padding: 0; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          line-height: 1.6;
        }
        .email-wrapper { 
          width: 100%; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff; 
          border-radius: 24px; 
          overflow: hidden; 
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 48px 40px;
          text-align: center;
          position: relative;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 20px solid transparent;
          border-right: 20px solid transparent;
          border-top: 20px solid #764ba2;
        }
        .header-icon {
          font-size: 56px;
          margin-bottom: 16px;
          display: block;
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .header h1 { 
          margin: 0; 
          font-size: 32px; 
          font-weight: 800; 
          letter-spacing: -0.5px;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header p { 
          margin: 12px 0 0; 
          color: rgba(255,255,255,0.9);
          font-size: 16px;
          font-weight: 500;
        }
        .content { 
          padding: 48px 40px;
          color: #374151;
        }
        .greeting {
          font-size: 18px;
          color: #111827;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .intro-text {
          font-size: 16px;
          color: #4B5563;
          margin-bottom: 32px;
          line-height: 1.7;
        }
        .highlight-name {
          color: #667eea;
          font-weight: 700;
        }
        
        /* Calendar Card Styling */
        .calendar-card {
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          border: 2px solid #c7d2fe;
          border-radius: 16px;
          padding: 0;
          margin: 32px 0;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .calendar-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .calendar-date-box {
          background: white;
          border-radius: 12px;
          padding: 12px 16px;
          text-align: center;
          min-width: 80px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .calendar-month {
          font-size: 12px;
          font-weight: 700;
          color: #667eea;
          letter-spacing: 1px;
        }
        .calendar-day {
          font-size: 32px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
          margin-top: 4px;
        }
        .event-title-header {
          flex: 1;
          color: white;
        }
        .event-title-header h2 {
          font-size: 24px;
          font-weight: 800;
          margin: 0 0 4px;
          line-height: 1.3;
          color: white;
        }
        .event-platform {
          font-size: 13px;
          opacity: 0.9;
          font-weight: 600;
        }
        
        .calendar-details {
          padding: 28px;
          background: white;
        }
        .detail-row {
          display: flex;
          align-items: flex-start;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-icon {
          font-size: 20px;
          margin-right: 16px;
          flex-shrink: 0;
          width: 24px;
          text-align: center;
        }
        .detail-content {
          flex: 1;
        }
        .detail-label {
          font-size: 12px;
          font-weight: 700;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .detail-value {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }
        .agenda-text {
          font-size: 15px;
          color: #4B5563;
          line-height: 1.7;
          margin-top: 8px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        
        /* CTA Button */
        .cta-section {
          text-align: center;
          margin: 40px 0;
          padding: 32px 24px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 16px;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          text-decoration: none;
          padding: 16px 48px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 18px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.4), 0 4px 6px -2px rgba(102, 126, 234, 0.2);
          letter-spacing: 0.3px;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 25px -5px rgba(102, 126, 234, 0.4), 0 10px 10px -5px rgba(102, 126, 234, 0.2);
        }
        .cta-subtitle {
          margin-top: 16px;
          font-size: 13px;
          color: #6B7280;
        }
        .direct-link {
          display: inline-block;
          margin-top: 12px;
          font-size: 12px;
          color: #667eea !important;
          word-break: break-all;
          padding: 8px 16px;
          background: white;
          border-radius: 6px;
          text-decoration: none;
        }
        
        /* Notes Box */
        .notes-box {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 2px solid #fbbf24;
          border-radius: 12px;
          padding: 20px;
          margin: 28px 0;
        }
        .notes-title {
          font-weight: 700;
          color: #92400e;
          font-size: 15px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .notes-content {
          color: #78350f;
          font-size: 14px;
          line-height: 1.6;
        }
        
        /* Participants */
        .participants-section {
          margin-top: 32px;
          padding: 24px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }
        .participants-title {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .participants-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .participant-tag {
          background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
          color: #4338ca;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          display: inline-block;
          border: 1px solid #c7d2fe;
        }
        
        /* Quick Actions */
        .quick-actions {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 32px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          flex-wrap: wrap;
        }
        .action-link {
          color: #667eea !important;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: white;
          border-radius: 8px;
          border: 2px solid #e0e7ff;
          transition: all 0.2s ease;
        }
        .action-link:hover {
          background: #e0e7ff;
          transform: translateY(-1px);
        }
        
        /* Footer */
        .footer {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 32px;
          text-align: center;
          border-top: 2px solid #e2e8f0;
        }
        .footer-logo {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
        }
        .footer-text {
          font-size: 13px;
          color: #64748b;
          line-height: 1.8;
          margin: 8px 0;
        }
        .footer-links {
          margin-top: 16px;
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .footer-link {
          color: #667eea !important;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
        }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .container { border-radius: 16px; }
          .header { padding: 32px 24px; }
          .header h1 { font-size: 26px; }
          .content { padding: 32px 24px; }
          .calendar-header { flex-direction: column; text-align: center; }
          .calendar-details { padding: 20px; }
          .cta-button { padding: 14px 32px; font-size: 16px; }
          .quick-actions { gap: 12px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          ${openPixelUrl ? `<img src="${openPixelUrl}" alt="" width="1" height="1" style="display:none;" />` : ''}
          
          <!-- Header -->
          <div class="header">
            <span class="header-icon">📧</span>
            <h1>Meeting Invitation</h1>
            <p>You're invited to join a meeting</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            <p class="greeting">Hello there! 👋</p>
            <p class="intro-text">
              <span class="highlight-name">${host}</span> has invited you to join an upcoming meeting. 
              All the details you need are below.
            </p>

            <!-- Calendar Card -->
            <div class="calendar-card">
              <div class="calendar-header">
                <div class="calendar-date-box">
                  <div class="calendar-month">${monthShort}</div>
                  <div class="calendar-day">${dayOfMonth}</div>
                </div>
                <div class="event-title-header">
                  <h2>${event.title}</h2>
                  <div class="event-platform">${providerLabel}</div>
                </div>
              </div>
              
              <div class="calendar-details">
                <div class="detail-row">
                  <div class="detail-icon">📅</div>
                  <div class="detail-content">
                    <div class="detail-label">Date</div>
                    <div class="detail-value">${formattedDate}</div>
                  </div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-icon">🕐</div>
                  <div class="detail-content">
                    <div class="detail-label">Time</div>
                    <div class="detail-value">${formattedTime}</div>
                  </div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-icon">⏱️</div>
                  <div class="detail-content">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${event.duration} minutes</div>
                  </div>
                </div>

                ${event.description ? `
                  <div class="detail-row">
                    <div class="detail-icon">📋</div>
                    <div class="detail-content">
                      <div class="detail-label">Agenda</div>
                      <div class="agenda-text">${event.description.replace(/\n/g, '<br>')}</div>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>

            ${notes ? `
              <div class="notes-box">
                <div class="notes-title">
                  <span>📌</span>
                  <span>Important Notes</span>
                </div>
                <div class="notes-content">${notes.replace(/\n/g, '<br>')}</div>
              </div>
            ` : ''}

            <!-- CTA Section -->
            <div class="cta-section">
              <a href="${trackedJoinUrl || joinLink}" class="cta-button">
                Join Meeting
              </a>
              <p class="cta-subtitle">Click the button above to join when it's time</p>
              ${options.includeDirectMeetingLink ? `
                <a href="${joinLink}" class="direct-link">${joinLink}</a>
              ` : ''}
            </div>

            ${teams && teams.length ? `
              <div class="participants-section" style="background: #f0fdf4; border-color: #bbf7d0; margin-bottom: 16px;">
                <div class="participants-title" style="color: #166534;">
                  <span>👥</span>
                  <span>Invited Teams (${teams.length})</span>
                </div>
                <ul class="participants-list">
                  ${teams.map(t => `<li class="participant-tag" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); color: #166534; border-color: #bbf7d0;">${t}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${participants.length ? `
              <div class="participants-section">
                <div class="participants-title">
                  <span>👥</span>
                  <span>Participants (${participants.length})</span>
                </div>
                <ul class="participants-list">
                  ${participants.map(p => `<li class="participant-tag">${p}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Quick Actions -->
            <div class="quick-actions">
              ${options.icsUrl || icsContent ? `
                <a href="${options.icsUrl || '#'}" class="action-link">
                  <span>📅</span>
                  <span>Add to Calendar</span>
                </a>
              ` : ''}
              ${ackUrl ? `
                <a href="${ackUrl}" class="action-link">
                  <span>✅</span>
                  <span>Confirm Receipt</span>
                </a>
              ` : ''}
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">Upcheck Meetings</div>
            <p class="footer-text">
              You're receiving this because you were invited to a meeting.
            </p>
            <div class="footer-links">
              <a href="#" class="footer-link">Privacy Policy</a>
              <a href="#" class="footer-link">Help Center</a>
              <a href="#" class="footer-link">Contact Us</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `Upcheck Meetings <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlBody,
    attachments: icsContent ? [
      {
        filename: `${safeTitle}.ics`,
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST'
      }
    ] : undefined,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return info;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw new Error('Failed to send email');
  }
};