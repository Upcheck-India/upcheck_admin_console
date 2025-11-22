/**
 * Enhanced Reminder Email Templates
 * Beautiful, responsive reminder emails with countdown timers and smart features
 */

/**
 * Generate enhanced reminder notification HTML email
 */
export function generateReminderNotificationHtml(meeting, options = {}) {
  const {
    openPixelUrl,
    trackedJoinUrl,
    ackUrl,
    trackingToken,
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    recipient,
    reminderTiming = 15, // minutes before meeting
    isSeriesMeeting = false,
    seriesInfo = null
  } = options;

  const startDate = new Date(meeting.startTime);
  const endDate = new Date(startDate.getTime() + (meeting.effectiveDuration * 60000));
  const now = new Date();
  const timeUntilMeeting = Math.max(0, Math.floor((startDate - now) / (1000 * 60))); // minutes

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date));
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    }).format(new Date(date));
  };

  const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    }).format(new Date(date));
  };

  const getUrgencyLevel = (minutes) => {
    if (minutes <= 15) return 'critical';
    if (minutes <= 60) return 'high';
    if (minutes <= 1440) return 'medium'; // 24 hours
    return 'low';
  };

  const getUrgencyColor = (level) => {
    switch (level) {
      case 'critical': return '#dc2626'; // red-600
      case 'high': return '#ea580c'; // orange-600
      case 'medium': return '#d97706'; // amber-600
      case 'low': return '#059669'; // emerald-600
      default: return '#6366f1'; // indigo-500
    }
  };

  const getTimingText = (minutes) => {
    if (minutes <= 0) return 'starting now';
    if (minutes < 60) return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        return `in ${hours}h ${remainingMinutes}m`;
      }
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `in ${days} day${days !== 1 ? 's' : ''}`;
      } else {
        return `in ${days}d ${remainingHours}h`;
      }
    }
  };

  const urgencyLevel = getUrgencyLevel(timeUntilMeeting);
  const urgencyColor = getUrgencyColor(urgencyLevel);
  const timingText = getTimingText(timeUntilMeeting);
  const providerName = meeting.provider === 'zoom' ? 'Zoom' : 'Google Meet';
  const providerIcon = meeting.provider === 'zoom' ? '🎥' : '📹';

  // Generate action URLs
  const joinNowUrl = trackedJoinUrl || meeting.joinUrl;
  const rescheduleUrl = `${baseUrl}/meetings/${meeting._id}/reschedule?token=${trackingToken}`;
  const declineUrl = `${baseUrl}/meetings/${meeting._id}/decline?token=${trackingToken}`;
  const calendarUrl = `${baseUrl}/api/calendar/meeting/${meeting._id}?token=${trackingToken}`;

  // Generate meeting preparation checklist
  const preparationItems = generatePreparationChecklist(meeting, timeUntilMeeting);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Meeting Reminder - ${meeting.effectiveTitle}</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
        .outlook-group-fix { width: 100% !important; }
      </style>
      <![endif]-->
      <style>
        /* Reset and Base Styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          margin: 0; 
          padding: 0; 
          background: linear-gradient(135deg, ${urgencyColor}15 0%, ${urgencyColor}25 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          line-height: 1.6;
          color: #374151;
        }
        
        /* Email Wrapper */
        .email-wrapper { 
          width: 100%; 
          background: linear-gradient(135deg, ${urgencyColor}15 0%, ${urgencyColor}25 100%);
          padding: 40px 20px;
          min-height: 100vh;
        }
        
        /* Main Container */
        .container { 
          max-width: 650px; 
          margin: 0 auto; 
          background-color: #ffffff; 
          border-radius: 24px; 
          overflow: hidden; 
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 3px solid ${urgencyColor}40;
        }
        
        /* Urgency Banner */
        .urgency-banner {
          background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
          padding: 16px 32px;
          text-align: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        
        /* Header Section */
        .header { 
          background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
          padding: 48px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
        }
        .header-content { position: relative; z-index: 2; }
        .header-icon {
          font-size: 64px;
          margin-bottom: 20px;
          display: block;
          animation: bounce 2s infinite;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .header h1 { 
          margin: 0; 
          font-size: 36px; 
          font-weight: 900; 
          letter-spacing: -0.5px;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          margin-bottom: 8px;
        }
        .header .subtitle { 
          margin: 0; 
          color: rgba(255,255,255,0.9);
          font-size: 18px;
          font-weight: 600;
        }
        
        /* Countdown Timer */
        .countdown-section {
          background: linear-gradient(135deg, ${urgencyColor}10 0%, ${urgencyColor}20 100%);
          padding: 40px 32px;
          text-align: center;
          border-bottom: 3px solid ${urgencyColor}30;
        }
        .countdown-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .countdown-timer {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .countdown-item {
          background: white;
          border: 3px solid ${urgencyColor};
          border-radius: 16px;
          padding: 20px 16px;
          min-width: 80px;
          text-align: center;
          box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }
        .countdown-number {
          font-size: 32px;
          font-weight: 900;
          color: ${urgencyColor};
          line-height: 1;
          margin-bottom: 8px;
        }
        .countdown-label {
          font-size: 12px;
          font-weight: 700;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .countdown-message {
          font-size: 20px;
          font-weight: 800;
          color: ${urgencyColor};
          margin-top: 16px;
        }
        
        /* Content Section */
        .content { 
          padding: 48px 40px;
          color: #374151;
        }
        .greeting {
          font-size: 20px;
          color: #111827;
          margin-bottom: 20px;
          font-weight: 700;
        }
        .intro-text {
          font-size: 17px;
          color: #4B5563;
          margin-bottom: 32px;
          line-height: 1.8;
        }
        .highlight-name {
          color: ${urgencyColor};
          font-weight: 800;
        }
        
        /* Meeting Details Card */
        .meeting-details {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 3px solid #e2e8f0;
          border-radius: 20px;
          padding: 0;
          margin: 32px 0;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .meeting-header {
          background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
          padding: 32px;
          text-align: center;
          position: relative;
        }
        .meeting-icon {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }
        .meeting-title {
          font-size: 28px;
          font-weight: 900;
          color: white;
          margin: 0 0 8px;
          line-height: 1.2;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .meeting-subtitle {
          font-size: 16px;
          color: rgba(255,255,255,0.9);
          font-weight: 600;
          margin: 0;
        }
        
        /* Meeting Info Grid */
        .meeting-info {
          padding: 36px 32px;
          background: white;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }
        .info-item {
          text-align: center;
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          border: 2px solid #f3f4f6;
          transition: all 0.3s ease;
        }
        .info-item:hover {
          border-color: ${urgencyColor}40;
          transform: translateY(-2px);
        }
        .info-icon {
          font-size: 24px;
          margin-bottom: 8px;
          display: block;
        }
        .info-label {
          font-size: 12px;
          color: #6B7280;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .info-value {
          font-size: 18px;
          color: #111827;
          font-weight: 700;
        }
        
        /* Series Information */
        ${isSeriesMeeting ? `
        .series-info {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 16px;
          padding: 24px;
          margin: 32px 0;
          text-align: center;
        }
        .series-icon {
          font-size: 32px;
          margin-bottom: 12px;
          display: block;
        }
        .series-title {
          font-size: 16px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .series-description {
          font-size: 14px;
          color: #a16207;
          font-weight: 600;
        }
        ` : ''}
        
        /* Preparation Checklist */
        .preparation-section {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px;
          margin: 32px 0;
        }
        .preparation-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .preparation-title {
          font-size: 22px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .preparation-subtitle {
          font-size: 14px;
          color: #6B7280;
          font-weight: 600;
        }
        .checklist {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .checklist-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .checklist-item:last-child {
          border-bottom: none;
        }
        .checklist-icon {
          width: 24px;
          height: 24px;
          background: ${urgencyColor}20;
          border: 2px solid ${urgencyColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: ${urgencyColor};
          flex-shrink: 0;
          margin-top: 2px;
        }
        .checklist-content {
          flex: 1;
        }
        .checklist-title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }
        .checklist-description {
          font-size: 14px;
          color: #6B7280;
          line-height: 1.6;
        }
        
        /* Quick Actions */
        .action-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin: 48px 0;
        }
        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 18px 24px;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          transition: all 0.3s ease;
          border: 2px solid transparent;
          text-align: center;
        }
        .action-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
        }
        .action-primary {
          background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
          color: white !important;
          box-shadow: 0 8px 20px -5px ${urgencyColor}40;
        }
        .action-secondary {
          background: white;
          color: ${urgencyColor} !important;
          border-color: ${urgencyColor}40;
          box-shadow: 0 4px 12px -2px rgba(0,0,0,0.1);
        }
        .action-secondary:hover {
          background: ${urgencyColor}10;
          border-color: ${urgencyColor};
        }
        .action-tertiary {
          background: #f9fafb;
          color: #374151 !important;
          border-color: #e5e7eb;
        }
        .action-tertiary:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }
        
        /* Participant List */
        ${meeting.effectiveParticipants && meeting.effectiveParticipants.length > 1 ? `
        .participants-section {
          background: #f9fafb;
          border-radius: 16px;
          padding: 28px;
          margin: 32px 0;
          border: 2px solid #f3f4f6;
        }
        .participants-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .participants-title {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          margin: 0;
        }
        .participants-count {
          background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }
        .participants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .participant-item {
          background: white;
          padding: 16px;
          border-radius: 10px;
          border: 2px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }
        .participant-item:hover {
          border-color: ${urgencyColor}40;
          transform: translateY(-1px);
        }
        .participant-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
        }
        .participant-email {
          font-size: 14px;
          color: #374151;
          font-weight: 600;
          word-break: break-word;
        }
        ` : ''}
        
        /* Footer */
        .footer {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 40px 32px;
          text-align: center;
          border-top: 3px solid #e2e8f0;
        }
        .footer-logo {
          font-size: 28px;
          font-weight: 900;
          background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 16px;
        }
        .footer-tagline {
          font-size: 16px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .footer-text {
          font-size: 14px;
          color: #64748b;
          line-height: 1.8;
          margin: 12px 0;
        }
        .footer-links {
          margin-top: 24px;
          display: flex;
          justify-content: center;
          gap: 32px;
          flex-wrap: wrap;
        }
        .footer-link {
          color: ${urgencyColor} !important;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: color 0.3s ease;
        }
        .footer-link:hover {
          color: ${urgencyColor}dd !important;
        }
        
        /* Responsive Design */
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .container { border-radius: 16px; }
          .header { padding: 32px 24px; }
          .header h1 { font-size: 28px; }
          .content { padding: 32px 24px; }
          .countdown-timer { gap: 12px; }
          .countdown-item { min-width: 60px; padding: 16px 12px; }
          .countdown-number { font-size: 24px; }
          .info-grid { grid-template-columns: 1fr; gap: 16px; }
          .action-buttons { grid-template-columns: 1fr; }
          .participants-grid { grid-template-columns: 1fr; }
          .footer-links { gap: 20px; }
        }
        
        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .container { background-color: #1f2937; }
          .content { color: #e5e7eb; }
          .greeting { color: #f9fafb; }
          .intro-text { color: #d1d5db; }
          .meeting-info { background: #374151; }
          .info-item { background: #4b5563; border-color: #6b7280; }
          .info-value { color: #f9fafb; }
          .preparation-section { background: #374151; }
          .checklist-title { color: #f9fafb; }
          .participants-section { background: #374151; }
          .participant-item { background: #4b5563; border-color: #6b7280; }
          .participant-email { color: #e5e7eb; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          ${openPixelUrl ? `<img src="${openPixelUrl}" alt="" width="1" height="1" style="display:none;" />` : ''}
          
          <!-- Urgency Banner -->
          <div class="urgency-banner">
            ${urgencyLevel === 'critical' ? '🚨 Meeting Starting Soon!' : 
              urgencyLevel === 'high' ? '⏰ Meeting Reminder' : 
              urgencyLevel === 'medium' ? '📅 Upcoming Meeting' : 
              '📋 Meeting Scheduled'}
          </div>
          
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <span class="header-icon">⏰</span>
              <h1>Meeting Reminder</h1>
              <p class="subtitle">Your meeting is ${timingText}</p>
            </div>
          </div>
          
          <!-- Countdown Timer -->
          <div class="countdown-section">
            <h2 class="countdown-title">Time Until Meeting</h2>
            ${timeUntilMeeting > 0 ? generateCountdownTimer(timeUntilMeeting) : `
              <div class="countdown-message">🎯 Meeting is starting now!</div>
            `}
          </div>
          
          <!-- Content -->
          <div class="content">
            <p class="greeting">Hello! 👋</p>
            <p class="intro-text">
              This is a friendly reminder that your meeting "<span class="highlight-name">${meeting.effectiveTitle}</span>" 
              ${timeUntilMeeting <= 15 ? 'is starting very soon' : `starts ${timingText}`}. 
              Everything you need to join and prepare is included below.
            </p>

            <!-- Meeting Details Card -->
            <div class="meeting-details">
              <div class="meeting-header">
                <span class="meeting-icon">${providerIcon}</span>
                <h2 class="meeting-title">${meeting.effectiveTitle}</h2>
                <p class="meeting-subtitle">${providerName} Meeting</p>
              </div>
              
              <div class="meeting-info">
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-icon">📅</span>
                    <div class="info-label">Date</div>
                    <div class="info-value">${formatDate(startDate)}</div>
                  </div>
                  <div class="info-item">
                    <span class="info-icon">🕐</span>
                    <div class="info-label">Time</div>
                    <div class="info-value">${formatTime(startDate)}</div>
                  </div>
                  <div class="info-item">
                    <span class="info-icon">⏱️</span>
                    <div class="info-label">Duration</div>
                    <div class="info-value">${meeting.effectiveDuration} min</div>
                  </div>
                  <div class="info-item">
                    <span class="info-icon">👥</span>
                    <div class="info-label">Participants</div>
                    <div class="info-value">${meeting.effectiveParticipants ? meeting.effectiveParticipants.length : 1}</div>
                  </div>
                </div>

                ${meeting.effectiveDescription ? `
                  <div style="background: #f0f4ff; border: 2px solid #c7d2fe; border-radius: 12px; padding: 20px; margin-top: 24px;">
                    <div style="font-size: 14px; font-weight: 700; color: #4338ca; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                      📋 Meeting Agenda
                    </div>
                    <div style="color: #374151; line-height: 1.7; font-size: 15px;">
                      ${meeting.effectiveDescription.replace(/\n/g, '<br>')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>

            ${isSeriesMeeting && seriesInfo ? `
              <!-- Series Information -->
              <div class="series-info">
                <span class="series-icon">🔄</span>
                <div class="series-title">Part of Recurring Series</div>
                <div class="series-description">${seriesInfo.description || 'This meeting is part of a recurring series'}</div>
              </div>
            ` : ''}

            <!-- Preparation Checklist -->
            <div class="preparation-section">
              <div class="preparation-header">
                <h3 class="preparation-title">
                  <span>✅</span>
                  <span>Meeting Preparation</span>
                </h3>
                <p class="preparation-subtitle">Quick checklist to ensure you're ready</p>
              </div>
              
              <ul class="checklist">
                ${preparationItems.map((item, index) => `
                  <li class="checklist-item">
                    <div class="checklist-icon">${index + 1}</div>
                    <div class="checklist-content">
                      <div class="checklist-title">${item.title}</div>
                      <div class="checklist-description">${item.description}</div>
                    </div>
                  </li>
                `).join('')}
              </ul>
            </div>

            <!-- Quick Actions -->
            <div class="action-buttons">
              <a href="${joinNowUrl}" class="action-button action-primary">
                <span>🚀</span>
                <span>Join Now</span>
              </a>
              <a href="${calendarUrl}" class="action-button action-secondary">
                <span>📅</span>
                <span>Add to Calendar</span>
              </a>
              <a href="${rescheduleUrl}" class="action-button action-tertiary">
                <span>📝</span>
                <span>Reschedule</span>
              </a>
              <a href="${declineUrl}" class="action-button action-tertiary">
                <span>❌</span>
                <span>Decline</span>
              </a>
            </div>

            ${meeting.effectiveParticipants && meeting.effectiveParticipants.length > 1 ? `
              <!-- Participant List -->
              <div class="participants-section">
                <div class="participants-header">
                  <h3 class="participants-title">Meeting Participants</h3>
                  <span class="participants-count">${meeting.effectiveParticipants.length}</span>
                </div>
                <div class="participants-grid">
                  ${meeting.effectiveParticipants.slice(0, 6).map(email => `
                    <div class="participant-item">
                      <div class="participant-avatar">
                        ${email.charAt(0).toUpperCase()}
                      </div>
                      <div class="participant-email">${email}</div>
                    </div>
                  `).join('')}
                  ${meeting.effectiveParticipants.length > 6 ? `
                    <div class="participant-item" style="border: 2px dashed ${urgencyColor}40; background: ${urgencyColor}10;">
                      <div class="participant-avatar" style="background: ${urgencyColor}40; color: ${urgencyColor};">
                        +${meeting.effectiveParticipants.length - 6}
                      </div>
                      <div class="participant-email" style="color: ${urgencyColor}; font-weight: 700;">
                        ${meeting.effectiveParticipants.length - 6} more participant${meeting.effectiveParticipants.length - 6 !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Important Notice -->
            <div style="background: linear-gradient(135deg, ${urgencyColor}10 0%, ${urgencyColor}20 100%); border: 2px solid ${urgencyColor}; border-radius: 16px; padding: 24px; margin: 32px 0; text-align: center;">
              <div style="font-size: 16px; font-weight: 700; color: ${urgencyColor}; margin-bottom: 12px;">
                ${timeUntilMeeting <= 15 ? '🚨 Join the meeting now!' : 
                  timeUntilMeeting <= 60 ? '⏰ Meeting starts soon!' : 
                  '📋 Don\'t forget your meeting!'}
              </div>
              <div style="color: #374151; font-size: 15px; line-height: 1.7;">
                ${timeUntilMeeting <= 15 ? 
                  'Your meeting is starting now. Click "Join Now" above to connect immediately.' :
                  timeUntilMeeting <= 60 ?
                  'Your meeting starts in less than an hour. Make sure you\'re prepared and ready to join.' :
                  'This is a reminder for your upcoming meeting. You\'ll receive another reminder closer to the start time.'}
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">Upcheck Meetings</div>
            <p class="footer-tagline">Never miss an important meeting</p>
            <p class="footer-text">
              This is an automated reminder for your scheduled meeting.
              <br>Need help? Contact our support team anytime.
            </p>
            <div class="footer-links">
              <a href="#" class="footer-link">Help Center</a>
              <a href="#" class="footer-link">Contact Support</a>
              <a href="#" class="footer-link">Meeting Settings</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate countdown timer HTML
 */
function generateCountdownTimer(totalMinutes) {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  let timerHtml = '<div class="countdown-timer">';
  
  if (days > 0) {
    timerHtml += `
      <div class="countdown-item">
        <div class="countdown-number">${days}</div>
        <div class="countdown-label">Day${days !== 1 ? 's' : ''}</div>
      </div>
    `;
  }
  
  if (hours > 0 || days > 0) {
    timerHtml += `
      <div class="countdown-item">
        <div class="countdown-number">${hours}</div>
        <div class="countdown-label">Hour${hours !== 1 ? 's' : ''}</div>
      </div>
    `;
  }
  
  timerHtml += `
    <div class="countdown-item">
      <div class="countdown-number">${minutes}</div>
      <div class="countdown-label">Minute${minutes !== 1 ? 's' : ''}</div>
    </div>
  `;
  
  timerHtml += '</div>';
  
  const urgencyMessage = totalMinutes <= 15 ? 
    '🚨 Join now!' : 
    totalMinutes <= 60 ? 
    '⏰ Starting soon!' : 
    '📅 Coming up!';
    
  timerHtml += `<div class="countdown-message">${urgencyMessage}</div>`;
  
  return timerHtml;
}

/**
 * Generate meeting preparation checklist
 */
function generatePreparationChecklist(meeting, timeUntilMeeting) {
  const items = [];
  
  // Basic preparation items
  items.push({
    title: 'Test your audio and video',
    description: `Ensure your microphone and camera are working properly for ${meeting.provider === 'zoom' ? 'Zoom' : 'Google Meet'}.`
  });
  
  items.push({
    title: 'Check your internet connection',
    description: 'Make sure you have a stable internet connection for the best meeting experience.'
  });
  
  if (meeting.effectiveDescription) {
    items.push({
      title: 'Review the meeting agenda',
      description: 'Familiarize yourself with the topics and prepare any questions or materials needed.'
    });
  }
  
  // Time-sensitive items
  if (timeUntilMeeting <= 60) {
    items.push({
      title: 'Find a quiet space',
      description: 'Choose a location with minimal background noise and distractions.'
    });
  }
  
  if (timeUntilMeeting <= 30) {
    items.push({
      title: 'Close unnecessary applications',
      description: 'Free up system resources by closing apps you don\'t need for the meeting.'
    });
  }
  
  if (timeUntilMeeting <= 15) {
    items.push({
      title: 'Have the join link ready',
      description: 'Keep this email open or bookmark the meeting link for quick access.'
    });
  }
  
  // Provider-specific items
  if (meeting.provider === 'zoom') {
    items.push({
      title: 'Update Zoom if needed',
      description: 'Make sure you have the latest version of Zoom installed for the best experience.'
    });
  } else if (meeting.provider === 'google_meet') {
    items.push({
      title: 'Use Chrome for best results',
      description: 'Google Meet works best in Chrome browser with the latest updates.'
    });
  }
  
  return items.slice(0, 6); // Limit to 6 items for better UX
}

/**
 * Generate plain text version of reminder notification
 */
export function generateReminderNotificationText(meeting, options = {}) {
  const {
    recipient,
    reminderTiming = 15,
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  } = options;

  const startDate = new Date(meeting.startTime);
  const now = new Date();
  const timeUntilMeeting = Math.max(0, Math.floor((startDate - now) / (1000 * 60)));

  const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    }).format(new Date(date));
  };

  const getTimingText = (minutes) => {
    if (minutes <= 0) return 'starting now';
    if (minutes < 60) return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        return `in ${hours}h ${remainingMinutes}m`;
      }
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `in ${days} day${days !== 1 ? 's' : ''}`;
      } else {
        return `in ${days}d ${remainingHours}h`;
      }
    }
  };

  const timingText = getTimingText(timeUntilMeeting);
  const providerName = meeting.provider === 'zoom' ? 'Zoom' : 'Google Meet';

  let text = `MEETING REMINDER: ${meeting.effectiveTitle}\n`;
  text += `${'='.repeat(50)}\n\n`;
  
  if (timeUntilMeeting <= 15) {
    text += `🚨 URGENT: Your meeting is starting ${timingText}!\n\n`;
  } else {
    text += `⏰ Reminder: Your meeting starts ${timingText}\n\n`;
  }
  
  text += `MEETING DETAILS:\n`;
  text += `- Title: ${meeting.effectiveTitle}\n`;
  text += `- Date & Time: ${formatDateTime(startDate)}\n`;
  text += `- Duration: ${meeting.effectiveDuration} minutes\n`;
  text += `- Platform: ${providerName}\n`;
  text += `- Join URL: ${meeting.joinUrl}\n`;
  
  if (meeting.effectiveDescription) {
    text += `- Agenda: ${meeting.effectiveDescription}\n`;
  }
  
  if (meeting.effectiveParticipants && meeting.effectiveParticipants.length > 1) {
    text += `\nPARTICIPANTS (${meeting.effectiveParticipants.length}):\n`;
    meeting.effectiveParticipants.forEach((email, index) => {
      text += `${index + 1}. ${email}\n`;
    });
  }
  
  text += `\nPREPARATION CHECKLIST:\n`;
  const preparationItems = generatePreparationChecklist(meeting, timeUntilMeeting);
  preparationItems.forEach((item, index) => {
    text += `${index + 1}. ${item.title}\n   ${item.description}\n\n`;
  });
  
  text += `QUICK ACTIONS:\n`;
  text += `- Join Meeting: ${meeting.joinUrl}\n`;
  text += `- Add to Calendar: ${baseUrl}/api/calendar/meeting/${meeting._id}\n`;
  text += `- Reschedule: ${baseUrl}/meetings/${meeting._id}/reschedule\n`;
  text += `- Decline: ${baseUrl}/meetings/${meeting._id}/decline\n\n`;
  
  if (timeUntilMeeting <= 15) {
    text += `⚠️  IMPORTANT: Your meeting is starting very soon!\n`;
    text += `Click the join link above to connect immediately.\n\n`;
  } else if (timeUntilMeeting <= 60) {
    text += `📋 Your meeting starts in less than an hour.\n`;
    text += `Make sure you're prepared and ready to join.\n\n`;
  }
  
  text += `---\n`;
  text += `Upcheck Meetings - Never miss an important meeting\n`;
  text += `This is an automated reminder for your scheduled meeting.\n`;

  return text;
}