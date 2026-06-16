/**
 * Premium Series Notification Email Template
 * Creates visually stunning, responsive email templates for recurring meeting series
 */

/**
 * Generate premium series notification HTML email
 */
export function generateSeriesNotificationHtml(series, upcomingMeetings, options = {}) {
  const { 
    openPixelUrl, 
    ackUrl, 
    trackingToken, 
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    recipient 
  } = options;

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

  const getRecurrenceDescription = (pattern) => {
    const { type, interval, daysOfWeek, dayOfMonth, endCondition } = pattern;
    
    let description = '';
    
    switch (type) {
      case 'daily':
        description = interval === 1 ? 'Daily' : `Every ${interval} days`;
        break;
      
      case 'weekly':
        if (interval === 1) {
          if (daysOfWeek && daysOfWeek.length > 0) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ');
            description = `Weekly on ${selectedDays}`;
          } else {
            description = 'Weekly';
          }
        } else {
          description = `Every ${interval} weeks`;
        }
        break;
      
      case 'monthly':
        if (dayOfMonth) {
          const suffix = getOrdinalSuffix(dayOfMonth);
          description = interval === 1 ? 
            `Monthly on the ${dayOfMonth}${suffix}` : 
            `Every ${interval} months on the ${dayOfMonth}${suffix}`;
        } else {
          description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        }
        break;
      
      default:
        description = 'Custom schedule';
    }
    
    if (endCondition.type === 'date') {
      const endDate = new Date(endCondition.endDate);
      description += ` until ${endDate.toLocaleDateString()}`;
    } else if (endCondition.type === 'count') {
      description += ` (${endCondition.occurrenceCount} meetings total)`;
    }
    
    return description;
  };

  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  const recurrenceText = getRecurrenceDescription(series.recurrencePattern);
  const totalMeetingsText = series.recurrencePattern.endCondition.type === 'count' ? 
    `${series.recurrencePattern.endCondition.occurrenceCount} meetings total` : 
    'Ongoing series';

  const providerName = series.provider === 'zoom' ? 'Zoom' : 'Google Meet';
  const providerColor = series.provider === 'zoom' ? '#2D8CFF' : '#0F9D58';
  const providerIcon = series.provider === 'zoom' ? '🎥' : '📹';

  // Generate calendar preview URLs
  const calendarUrl = `${baseUrl}/api/calendar/series/${series._id}?token=${trackingToken}`;
  const seriesUrl = `${baseUrl}/meetings/series/${series._id}?token=${trackingToken}`;
  const preferencesUrl = `${baseUrl}/preferences?token=${trackingToken}`;
  const calendarPreviewUrl = `${baseUrl}/api/calendar/preview?seriesId=${series._id}&format=json`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>New Meeting Series - ${series.title}</title>
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          line-height: 1.6;
          color: #374151;
        }
        
        /* Email Wrapper */
        .email-wrapper { 
          width: 100%; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        }
        
        /* Header Section */
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 48px 40px 60px;
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
          color: rgba(255,255,255,0.95);
          font-size: 18px;
          font-weight: 600;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: -24px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 24px solid transparent;
          border-right: 24px solid transparent;
          border-top: 24px solid #764ba2;
          z-index: 3;
        }
        
        /* Content Section */
        .content { 
          padding: 60px 40px 48px;
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
          margin-bottom: 40px;
          line-height: 1.8;
        }
        .highlight-name {
          color: #667eea;
          font-weight: 800;
        }
        
        /* Series Overview Card */
        .series-overview {
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          border: 3px solid #c7d2fe;
          border-radius: 20px;
          padding: 0;
          margin: 40px 0;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .series-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 32px;
          text-align: center;
          position: relative;
        }
        .series-icon {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }
        .series-title {
          font-size: 28px;
          font-weight: 900;
          color: white;
          margin: 0 0 8px;
          line-height: 1.2;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .series-subtitle {
          font-size: 16px;
          color: rgba(255,255,255,0.9);
          font-weight: 600;
          margin: 0;
        }
        
        /* Series Details Grid */
        .series-details {
          padding: 36px 32px;
          background: white;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }
        .detail-item {
          text-align: center;
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          border: 2px solid #f3f4f6;
          transition: all 0.3s ease;
        }
        .detail-item:hover {
          border-color: #c7d2fe;
          transform: translateY(-2px);
        }
        .detail-icon {
          font-size: 24px;
          margin-bottom: 8px;
          display: block;
        }
        .detail-label {
          font-size: 12px;
          color: #6B7280;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .detail-value {
          font-size: 18px;
          color: #111827;
          font-weight: 700;
        }
        
        /* Recurrence Pattern Visualization */
        .recurrence-pattern {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 16px;
          padding: 24px;
          margin: 32px 0;
          text-align: center;
        }
        .pattern-icon {
          font-size: 32px;
          margin-bottom: 12px;
          display: block;
        }
        .pattern-title {
          font-size: 16px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .pattern-description {
          font-size: 20px;
          color: #78350f;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .pattern-details {
          font-size: 14px;
          color: #a16207;
          font-weight: 600;
        }
        
        /* Interactive Calendar Timeline */
        .calendar-timeline {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px;
          margin: 40px 0;
        }
        .timeline-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .timeline-title {
          font-size: 22px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .timeline-subtitle {
          font-size: 14px;
          color: #6B7280;
          font-weight: 600;
        }
        
        /* Meeting Timeline Items */
        .timeline-container {
          position: relative;
          padding-left: 32px;
        }
        .timeline-line {
          position: absolute;
          left: 15px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(to bottom, #667eea, #764ba2);
        }
        .timeline-item {
          position: relative;
          margin-bottom: 24px;
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px 24px;
          border-left: 4px solid #667eea;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }
        .timeline-item:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .timeline-item:last-child {
          margin-bottom: 0;
        }
        .timeline-dot {
          position: absolute;
          left: -38px;
          top: 24px;
          width: 12px;
          height: 12px;
          background: #667eea;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 2px #667eea;
        }
        .meeting-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .meeting-date-time {
          flex: 1;
        }
        .meeting-date {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }
        .meeting-time {
          font-size: 14px;
          color: #6B7280;
          font-weight: 600;
        }
        .meeting-status {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #065f46;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid #10b981;
        }
        
        /* More meetings indicator */
        .more-meetings {
          text-align: center;
          margin-top: 24px;
          padding: 20px;
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          border-radius: 12px;
          border: 2px dashed #667eea;
        }
        .more-meetings-text {
          font-size: 16px;
          color: #4338ca;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .more-meetings-subtitle {
          font-size: 14px;
          color: #6366f1;
          font-weight: 600;
        }
        
        /* Participant List */
        .participants-section {
          background: #f9fafb;
          border-radius: 16px;
          padding: 28px;
          margin: 40px 0;
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          border-color: #c7d2fe;
          transform: translateY(-1px);
        }
        .participant-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        
        /* One-Click Actions */
        .action-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        }
        .action-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
        }
        .action-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          box-shadow: 0 8px 20px -5px rgba(102, 126, 234, 0.4);
        }
        .action-secondary {
          background: white;
          color: #667eea !important;
          border-color: #c7d2fe;
          box-shadow: 0 4px 12px -2px rgba(0,0,0,0.1);
        }
        .action-secondary:hover {
          background: #f0f4ff;
          border-color: #667eea;
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          color: #667eea !important;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: color 0.3s ease;
        }
        .footer-link:hover {
          color: #4338ca !important;
        }
        
        /* Responsive Design */
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 20px 10px; }
          .container { border-radius: 16px; }
          .header { padding: 32px 24px 48px; }
          .header h1 { font-size: 28px; }
          .content { padding: 48px 24px 32px; }
          .details-grid { grid-template-columns: 1fr; gap: 16px; }
          .action-buttons { grid-template-columns: 1fr; }
          .participants-grid { grid-template-columns: 1fr; }
          .timeline-container { padding-left: 24px; }
          .timeline-dot { left: -30px; }
          .meeting-info { flex-direction: column; gap: 12px; }
          .footer-links { gap: 20px; }
        }
        
        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .container { background-color: #1f2937; }
          .content { color: #e5e7eb; }
          .greeting { color: #f9fafb; }
          .intro-text { color: #d1d5db; }
          .series-details { background: #374151; }
          .detail-item { background: #4b5563; border-color: #6b7280; }
          .detail-value { color: #f9fafb; }
          .timeline-item { background: #374151; }
          .meeting-date { color: #f9fafb; }
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
          
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <span class="header-icon">🔄</span>
              <h1>New Meeting Series</h1>
              <p class="subtitle">You've been added to a recurring meeting</p>
            </div>
          </div>
          
          <!-- Content -->
          <div class="content">
            <p class="greeting">Hello! 👋</p>
            <p class="intro-text">
              <span class="highlight-name">${series.host}</span> has created a new recurring meeting series and added you as a participant. 
              This email contains everything you need to know about the upcoming meetings, including the schedule, 
              recurrence pattern, and quick actions to manage your participation.
            </p>

            <!-- Series Overview Card -->
            <div class="series-overview">
              <div class="series-header">
                <span class="series-icon">${providerIcon}</span>
                <h2 class="series-title">${series.title}</h2>
                <p class="series-subtitle">${providerName} Meeting Series</p>
              </div>
              
              <div class="series-details">
                <div class="details-grid">
                  <div class="detail-item">
                    <span class="detail-icon">⏱️</span>
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${series.duration} min</div>
                  </div>
                  <div class="detail-item">
                    <span class="detail-icon">👥</span>
                    <div class="detail-label">Participants</div>
                    <div class="detail-value">${series.participants.length}</div>
                  </div>
                  <div class="detail-item">
                    <span class="detail-icon">📊</span>
                    <div class="detail-label">Platform</div>
                    <div class="detail-value">${providerName}</div>
                  </div>
                  <div class="detail-item">
                    <span class="detail-icon">📈</span>
                    <div class="detail-label">Series</div>
                    <div class="detail-value">${totalMeetingsText.split(' ')[0]}</div>
                  </div>
                </div>

                ${series.description ? `
                  <div style="background: #f0f4ff; border: 2px solid #c7d2fe; border-radius: 12px; padding: 20px; margin-top: 24px;">
                    <div style="font-size: 14px; font-weight: 700; color: #4338ca; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                      📋 Meeting Description
                    </div>
                    <div style="color: #374151; line-height: 1.7; font-size: 15px;">
                      ${series.description.replace(/\n/g, '<br>')}
                    </div>
                  </div>
                ` : ''}

                ${series.teams && series.teams.length ? `
                  <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-top: 24px;">
                    <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                      👥 Selected Teams
                    </div>
                    <div style="font-size: 15px; color: #14532d; font-weight: 600;">
                      ${series.teams.join(', ')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Recurrence Pattern Visualization -->
            <div class="recurrence-pattern">
              <span class="pattern-icon">🔄</span>
              <div class="pattern-title">Recurrence Pattern</div>
              <div class="pattern-description">${recurrenceText}</div>
              <div class="pattern-details">${totalMeetingsText}</div>
            </div>

            <!-- Interactive Calendar Timeline -->
            ${upcomingMeetings.length > 0 ? `
              <div class="calendar-timeline">
                <div class="timeline-header">
                  <h3 class="timeline-title">
                    <span>📅</span>
                    <span>Upcoming Meetings</span>
                  </h3>
                  <p class="timeline-subtitle">Next ${Math.min(upcomingMeetings.length, 8)} scheduled meetings</p>
                </div>
                
                <div class="timeline-container">
                  <div class="timeline-line"></div>
                  ${upcomingMeetings.slice(0, 8).map((meeting, index) => `
                    <div class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div class="meeting-info">
                        <div class="meeting-date-time">
                          <div class="meeting-date">${formatDate(meeting.startTime)}</div>
                          <div class="meeting-time">${formatTime(meeting.startTime)}</div>
                        </div>
                        <div class="meeting-status">Meeting ${index + 1}</div>
                      </div>
                    </div>
                  `).join('')}
                  
                  ${upcomingMeetings.length > 8 ? `
                    <div class="more-meetings">
                      <div class="more-meetings-text">+ ${upcomingMeetings.length - 8} more meetings</div>
                      <div class="more-meetings-subtitle">View complete schedule in your calendar</div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Participant List -->
            ${series.participants.length > 0 ? `
              <div class="participants-section">
                <div class="participants-header">
                  <h3 class="participants-title">Meeting Participants</h3>
                  <span class="participants-count">${series.participants.length}</span>
                </div>
                <div class="participants-grid">
                  ${series.participants.slice(0, 6).map(email => `
                    <div class="participant-item">
                      <div class="participant-avatar">
                        ${email.charAt(0).toUpperCase()}
                      </div>
                      <div class="participant-email">${email}</div>
                    </div>
                  `).join('')}
                  ${series.participants.length > 6 ? `
                    <div class="participant-item" style="border: 2px dashed #c7d2fe; background: #f0f4ff;">
                      <div class="participant-avatar" style="background: #c7d2fe; color: #4338ca;">
                        +${series.participants.length - 6}
                      </div>
                      <div class="participant-email" style="color: #4338ca; font-weight: 700;">
                        ${series.participants.length - 6} more participant${series.participants.length - 6 !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- One-Click Actions -->
            <div class="action-buttons">
              <a href="${calendarUrl}" class="action-button action-primary">
                <span>📅</span>
                <span>Add to Calendar</span>
              </a>
              <a href="${seriesUrl}" class="action-button action-secondary">
                <span>👁️</span>
                <span>View Series</span>
              </a>
              <a href="${preferencesUrl}" class="action-button action-tertiary">
                <span>⚙️</span>
                <span>Manage Preferences</span>
              </a>
              ${ackUrl ? `
                <a href="${ackUrl}" class="action-button action-secondary">
                  <span>✅</span>
                  <span>Acknowledge Receipt</span>
                </a>
              ` : ''}
            </div>

            <!-- Important Notice -->
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; margin: 32px 0; text-align: center;">
              <div style="font-size: 16px; font-weight: 700; color: #92400e; margin-bottom: 12px;">
                📧 What happens next?
              </div>
              <div style="color: #78350f; font-size: 15px; line-height: 1.7;">
                You'll receive individual meeting invitations before each session with join links, 
                reminders, and any meeting-specific details. No action is required from you right now.
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">Upcheck Meetings</div>
            <p class="footer-tagline">Seamless meeting management for modern teams</p>
            <p class="footer-text">
              You're receiving this because you were added to a recurring meeting series by ${series.host}.
              <br>Individual meeting invitations will be sent separately for each occurrence.
            </p>
            <div class="footer-links">
              <a href="#" class="footer-link">Privacy Policy</a>
              <a href="#" class="footer-link">Help Center</a>
              <a href="#" class="footer-link">Contact Support</a>
              <a href="#" class="footer-link">Unsubscribe</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text version of series notification
 */
export function generateSeriesNotificationText(series, upcomingMeetings, options = {}) {
  const { recipient, baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' } = options;

  const formatDate = (date) => {
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

  const getRecurrenceDescription = (pattern) => {
    const { type, interval, daysOfWeek, dayOfMonth, endCondition } = pattern;
    
    let description = '';
    
    switch (type) {
      case 'daily':
        description = interval === 1 ? 'Daily' : `Every ${interval} days`;
        break;
      
      case 'weekly':
        if (interval === 1) {
          if (daysOfWeek && daysOfWeek.length > 0) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ');
            description = `Weekly on ${selectedDays}`;
          } else {
            description = 'Weekly';
          }
        } else {
          description = `Every ${interval} weeks`;
        }
        break;
      
      case 'monthly':
        if (dayOfMonth) {
          const suffix = dayOfMonth % 10 === 1 && dayOfMonth !== 11 ? 'st' :
                        dayOfMonth % 10 === 2 && dayOfMonth !== 12 ? 'nd' :
                        dayOfMonth % 10 === 3 && dayOfMonth !== 13 ? 'rd' : 'th';
          description = interval === 1 ? 
            `Monthly on the ${dayOfMonth}${suffix}` : 
            `Every ${interval} months on the ${dayOfMonth}${suffix}`;
        } else {
          description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        }
        break;
      
      default:
        description = 'Custom schedule';
    }
    
    if (endCondition.type === 'date') {
      const endDate = new Date(endCondition.endDate);
      description += ` until ${endDate.toLocaleDateString()}`;
    } else if (endCondition.type === 'count') {
      description += ` (${endCondition.occurrenceCount} meetings total)`;
    }
    
    return description;
  };

  const recurrenceText = getRecurrenceDescription(series.recurrencePattern);
  const providerName = series.provider === 'zoom' ? 'Zoom' : 'Google Meet';

  let text = `NEW MEETING SERIES: ${series.title}\n`;
  text += `${'='.repeat(50)}\n\n`;
  
  text += `Hello!\n\n`;
  text += `${series.host} has created a new recurring meeting series and added you as a participant.\n\n`;
  
  text += `MEETING DETAILS:\n`;
  text += `- Title: ${series.title}\n`;
  text += `- Platform: ${providerName}\n`;
  text += `- Duration: ${series.duration} minutes\n`;
  text += `- Participants: ${series.participants.length} people\n`;
  
  if (series.description) {
    text += `- Description: ${series.description}\n`;
  }
  
  text += `\nRECURRENCE PATTERN:\n`;
  text += `${recurrenceText}\n\n`;
  
  if (upcomingMeetings.length > 0) {
    text += `UPCOMING MEETINGS:\n`;
    upcomingMeetings.slice(0, 10).forEach((meeting, index) => {
      text += `${index + 1}. ${formatDate(meeting.startTime)}\n`;
    });
    
    if (upcomingMeetings.length > 10) {
      text += `... and ${upcomingMeetings.length - 10} more meetings\n`;
    }
    text += `\n`;
  }
  
  text += `PARTICIPANTS:\n`;
  series.participants.forEach((email, index) => {
    text += `${index + 1}. ${email}\n`;
  });
  
  text += `\nQUICK ACTIONS:\n`;
  text += `- Add to Calendar: ${baseUrl}/api/calendar/series/${series._id}\n`;
  text += `- View Series: ${baseUrl}/meetings/series/${series._id}\n`;
  text += `- Manage Preferences: ${baseUrl}/preferences\n\n`;
  
  text += `WHAT HAPPENS NEXT:\n`;
  text += `You'll receive individual meeting invitations before each session with join links, `;
  text += `reminders, and any meeting-specific details. No action is required from you right now.\n\n`;
  
  text += `---\n`;
  text += `Upcheck Meetings - Seamless meeting management for modern teams\n`;
  text += `You're receiving this because you were added to a recurring meeting series.\n`;
  text += `Individual meeting invitations will be sent separately for each occurrence.\n`;

  return text;
}