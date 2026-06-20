import * as ics from 'ics';
import { sendEmail as sendUnifiedEmail } from './emailService.js';

// ─── Date / Time Formatters (IST) ───────────────────────────────────────────

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));

const formatTime = (date) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone: 'Asia/Kolkata',
    timeZoneName: 'short',
  }).format(new Date(date));

const getDayOfMonth = (date) => new Date(date).getDate();

const getMonthShort = (date) =>
  new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
    .format(new Date(date))
    .toUpperCase();

const getWeekdayShort = (date) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    timeZone: 'Asia/Kolkata',
  })
    .format(new Date(date))
    .toUpperCase();

// ─── Brand Tokens ────────────────────────────────────────────────────────────
//  Primary   #0D5EF0  – Upcheck blue
//  Dark      #0A3FA0  – deep navy for header bg
//  Accent    #00C896  – teal-green (aquaculture nod)
//  Surface   #F4F7FD  – off-white card bg
//  Muted     #6B7A99  – secondary text
//  Border    #DDE3EF  – dividers
//  Text      #111928  – primary text
//  Danger    #F97316  – warm accent for notes

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Sends a styled meeting-invitation email that is safe across major email
 * clients (Gmail, Outlook, Apple Mail, Yahoo Mail).
 *
 * Key design decisions vs. the previous version
 * ─────────────────────────────────────────────
 * • Uses TABLE-based layout throughout — flex/grid are Outlook landmines.
 * • All colours, padding, and font sizes are INLINE — external <style> blocks
 *   are stripped by Gmail and many mobile clients.
 * • No CSS animations, transforms, or :hover rules.
 * • No position:absolute / CSS triangles that break in MSO.
 * • -webkit-background-clip:text removed (renders as invisible in Outlook).
 * • Upcheck Technologies branding applied to header, footer, and palette.
 * • Company name → "Upcheck Technologies Private Limited"
 */
export const sendEmail = async (to, subject, options) => {
  const {
    host,
    event,
    participants = [],
    teams = [],
    notes,
    openPixelUrl,
    trackedJoinUrl,
    ackUrl,
  } = options;

  const joinLink = event.joinUrl || event.zoomMeetingUrl;
  const providerLabel =
    event.provider === 'google_meet' ? 'Google Meet' : 'Zoom';
  const providerBadgeColor =
    event.provider === 'google_meet' ? '#0F9D58' : '#2D8CFF';

  // ── ICS Attachment ──────────────────────────────────────────────────────
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
    organizer: { name: 'Upcheck Technologies', email: host },
    url: joinLink,
    location: providerLabel,
    alarms: [
      {
        action: 'display',
        description: 'Event reminder',
        trigger: { minutes: 15, before: true },
      },
    ],
    attendees: (participants || []).map((p) => ({
      email: p,
      rsvp: true,
      partstat: 'NEEDS-ACTION',
    })),
  };

  const { error: icsError, value: icsContent } = ics.createEvent(eventData);
  if (icsError) console.error('Failed generating ICS:', icsError);

  const safeTitle = (event.title || 'event').replace(/[^a-zA-Z0-9]/g, '_');

  // ── Formatted Values ────────────────────────────────────────────────────
  const formattedDate    = formatDate(event.startTime);
  const formattedTime    = formatTime(event.startTime);
  const dayOfMonth       = getDayOfMonth(event.startTime);
  const monthShort       = getMonthShort(event.startTime);
  const weekdayShort     = getWeekdayShort(event.startTime);

  // ── Helpers: table-based row building ───────────────────────────────────
  const detailRow = (icon, label, valueHtml) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #DDE3EF;vertical-align:top;width:36px;">
        <span style="font-size:18px;line-height:1;">${icon}</span>
      </td>
      <td style="padding:14px 0 14px 12px;border-bottom:1px solid #DDE3EF;vertical-align:top;">
        <div style="font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">${label}</div>
        <div style="font-size:15px;font-weight:600;color:#111928;line-height:1.4;">${valueHtml}</div>
      </td>
    </tr>`;

  // ── Participant / Team tag ───────────────────────────────────────────────
  const tag = (text, bg, color, border) =>
    `<span style="display:inline-block;background:${bg};color:${color};border:1px solid ${border};padding:5px 14px;border-radius:20px;font-size:13px;font-weight:600;margin:4px 4px 0 0;">${text}</span>`;

  // ── HTML Body ───────────────────────────────────────────────────────────
  const htmlBody = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Meeting Invitation — ${event.title}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
    body{margin:0!important;padding:0!important;width:100%!important;}
    /* Mobile */
    @media only screen and (max-width:600px){
      .email-body-wrap{padding:16px 8px!important;}
      .email-container{border-radius:12px!important;}
      .header-pad{padding:32px 24px!important;}
      .content-pad{padding:28px 20px!important;}
      .logo-size{font-size:20px!important;}
      .cta-btn{padding:14px 28px!important;font-size:16px!important;}
      .calendar-day-col{display:block!important;width:100%!important;text-align:center!important;}
      .calendar-title-col{display:block!important;width:100%!important;padding-top:12px!important;}
      .footer-pad{padding:24px 20px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#E8EDF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

${openPixelUrl ? `<img src="${openPixelUrl}" alt="" width="1" height="1" style="display:none;border:0;height:1px;width:1px;">` : ''}

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E8EDF7;">
  <tr>
    <td class="email-body-wrap" align="center" style="padding:40px 16px;">

      <!-- Email container -->
      <table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(13,94,240,0.10);">

        <!-- ══ HEADER ══ -->
        <tr>
          <td class="header-pad" style="background-color:#0A3FA0;padding:40px 40px 36px;text-align:center;">
            <!-- Logo wordmark -->
            <div style="margin-bottom:24px;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Upcheck</span>
              <span style="font-size:22px;font-weight:300;color:#7DB4FF;letter-spacing:-0.3px;"> Technologies</span>
            </div>
            <!-- Teal accent rule -->
            <div style="width:48px;height:3px;background-color:#00C896;border-radius:2px;margin:0 auto 24px;"></div>
            <!-- Headline -->
            <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1.25;">
              You're Invited to a Meeting
            </h1>
            <p style="margin:10px 0 0;font-size:15px;color:#A8C5FF;font-weight:400;">
              ${host} has scheduled a meeting with you
            </p>
          </td>
        </tr>

        <!-- ══ CONTENT ══ -->
        <tr>
          <td class="content-pad" style="padding:40px;">

            <!-- ── Calendar Card ── -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:14px;overflow:hidden;border:1px solid #DDE3EF;margin-bottom:32px;">

              <!-- Card header: date strip + title -->
              <tr style="background-color:#0D5EF0;">
                <!-- Date box -->
                <td class="calendar-day-col" valign="middle" style="padding:24px 20px;width:90px;text-align:center;background-color:#0A3FA0;border-right:1px solid rgba(255,255,255,0.12);">
                  <div style="font-size:11px;font-weight:700;color:#7DB4FF;letter-spacing:1.5px;">${weekdayShort}</div>
                  <div style="font-size:40px;font-weight:800;color:#ffffff;line-height:1;margin:4px 0;">${dayOfMonth}</div>
                  <div style="font-size:13px;font-weight:700;color:#00C896;letter-spacing:1px;">${monthShort}</div>
                </td>
                <!-- Event title -->
                <td class="calendar-title-col" valign="middle" style="padding:24px;background-color:#0D5EF0;">
                  <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;margin-bottom:8px;">${event.title}</div>
                  <span style="display:inline-block;background-color:${providerBadgeColor};color:#ffffff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">
                    ${providerLabel}
                  </span>
                </td>
              </tr>

              <!-- Card details -->
              <tr>
                <td colspan="2" style="padding:4px 24px 8px;background-color:#F4F7FD;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${detailRow('📅', 'Date', formattedDate)}
                    ${detailRow('🕐', 'Time', formattedTime)}
                    ${detailRow('⏱', 'Duration', `${event.duration} minutes`)}
                    ${event.description
                      ? detailRow(
                          '📋',
                          'Agenda',
                          `<div style="font-size:14px;font-weight:400;color:#374151;line-height:1.7;margin-top:6px;padding:14px 16px;background:#ffffff;border-radius:8px;border-left:3px solid #00C896;">${event.description.replace(/\n/g, '<br>')}</div>`
                        )
                      : ''}
                  </table>
                </td>
              </tr>
            </table>
            <!-- /Calendar Card -->

            <!-- ── Notes ── -->
            ${notes
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                  <tr>
                    <td style="background-color:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:18px 20px;">
                      <div style="font-size:13px;font-weight:700;color:#9A3412;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📌 &nbsp;Important Notes</div>
                      <div style="font-size:14px;color:#7C2D12;line-height:1.7;">${notes.replace(/\n/g, '<br>')}</div>
                    </td>
                  </tr>
                </table>`
              : ''}

            <!-- ── CTA ── -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
              <tr>
                <td align="center" style="background-color:#F4F7FD;border-radius:14px;padding:32px 24px;">
                  <p style="margin:0 0 20px;font-size:15px;color:#374151;">
                    Ready when you are — click below to join at the scheduled time.
                  </p>
                  <!-- Bulletproof button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                    <tr>
                      <td style="border-radius:10px;background-color:#0D5EF0;text-align:center;">
                        <a href="${trackedJoinUrl || joinLink}"
                           target="_blank"
                           class="cta-btn"
                           style="display:inline-block;padding:15px 44px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;mso-padding-alt:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <!--[if mso]>&nbsp;<![endif]-->
                          Join Meeting
                          <!--[if mso]>&nbsp;<![endif]-->
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:14px 0 0;font-size:12px;color:#6B7A99;">
                    A calendar invite (.ics) is attached — add it directly to your calendar.
                  </p>
                  ${options.includeDirectMeetingLink && joinLink
                    ? `<p style="margin:10px 0 0;"><a href="${joinLink}" style="font-size:12px;color:#0D5EF0;word-break:break-all;">${joinLink}</a></p>`
                    : ''}
                </td>
              </tr>
            </table>

            <!-- ── Teams ── -->
            ${teams && teams.length
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                  <tr>
                    <td style="background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:18px 20px;">
                      <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:10px;">👥 &nbsp;Invited Teams (${teams.length})</div>
                      ${teams.map((t) => tag(t, '#DCFCE7', '#166534', '#BBF7D0')).join('')}
                    </td>
                  </tr>
                </table>`
              : ''}

            <!-- ── Participants ── -->
            ${participants.length
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                  <tr>
                    <td style="background-color:#F4F7FD;border:1px solid #DDE3EF;border-radius:10px;padding:18px 20px;">
                      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">👤 &nbsp;Participants (${participants.length})</div>
                      ${participants.map((p) => tag(p, '#E0E7FF', '#3730A3', '#C7D2FE')).join('')}
                    </td>
                  </tr>
                </table>`
              : ''}

            <!-- ── Quick Actions ── -->
            ${ackUrl || (options.icsUrl || icsContent)
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                  <tr>
                    <td align="center" style="padding:16px 0;">
                      ${(options.icsUrl || icsContent)
                        ? `<a href="${options.icsUrl || '#'}" style="display:inline-block;margin:4px 8px;padding:9px 18px;background:#ffffff;border:1px solid #DDE3EF;border-radius:8px;font-size:13px;font-weight:600;color:#0D5EF0;text-decoration:none;">📅 &nbsp;Add to Calendar</a>`
                        : ''}
                      ${ackUrl
                        ? `<a href="${ackUrl}" style="display:inline-block;margin:4px 8px;padding:9px 18px;background:#ffffff;border:1px solid #DDE3EF;border-radius:8px;font-size:13px;font-weight:600;color:#0D5EF0;text-decoration:none;">✅ &nbsp;Confirm Receipt</a>`
                        : ''}
                    </td>
                  </tr>
                </table>`
              : ''}

          </td>
        </tr>
        <!-- /CONTENT -->

        <!-- ══ FOOTER ══ -->
        <tr>
          <td class="footer-pad" style="background-color:#F4F7FD;border-top:1px solid #DDE3EF;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0A3FA0;">Upcheck Technologies Private Limited</p>
            <p style="margin:0 0 16px;font-size:12px;color:#6B7A99;">
              You received this invitation because ${host} scheduled a meeting that includes you.
            </p>
            <!-- Divider -->
            <div style="width:40px;height:2px;background-color:#00C896;border-radius:1px;margin:0 auto 16px;"></div>
            <!-- Footer links -->
            <p style="margin:0;font-size:12px;color:#6B7A99;">
              <a href="#" style="color:#0D5EF0;text-decoration:none;font-weight:600;">Privacy Policy</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="#" style="color:#0D5EF0;text-decoration:none;font-weight:600;">Help Center</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="#" style="color:#0D5EF0;text-decoration:none;font-weight:600;">Contact Us</a>
            </p>
          </td>
        </tr>
        <!-- /FOOTER -->

      </table>
      <!-- /Email container -->

    </td>
  </tr>
</table>
<!-- /Outer wrapper -->

</body>
</html>`;

  // ── Send ───────────────────────────────────────────────────────────────
  try {
    const result = await sendUnifiedEmail({
      to,
      subject,
      html: htmlBody,
      attachments: icsContent
        ? [
            {
              filename: `${safeTitle}.ics`,
              content: icsContent,
              contentType: 'text/calendar; charset=utf-8; method=REQUEST',
            },
          ]
        : undefined,
      type: 'meeting_invite',
    });

    if (!result.success) throw new Error(result.error || 'Failed to send email');

    console.log(`✅ Email sent successfully to ${to}`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw new Error('Failed to send email');
  }
};