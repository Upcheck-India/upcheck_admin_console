/**
 * Booking confirmation emails (invitee + owner) for the native scheduling module.
 * Uses the generic emailService (Brevo → nodemailer), so it no-ops cleanly when
 * notifications are disabled or no transport is configured.
 */
import { sendEmail, EMAIL_TYPES } from './emailService';

function fmt(dt, tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).format(new Date(dt));
  } catch {
    return new Date(dt).toUTCString();
  }
}

function shell(title, bodyRows) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F5F8FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1A222B;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#0B6DC7,#00CDE8);border-radius:16px 16px 0 0;padding:24px;color:#fff;">
      <div style="font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.85;">Upcheck Scheduling</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">${title}</div>
    </div>
    <div style="background:#fff;border:1px solid #E0E8EC;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${bodyRows}
      </table>
    </div>
    <div style="text-align:center;color:#7A909F;font-size:12px;margin-top:16px;">Sent by Upcheck</div>
  </div>
</body></html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#7A909F;width:90px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;color:#1A222B;font-weight:600;">${value}</td>
  </tr>`;
}

/**
 * Send confirmation emails for a new booking. Best-effort; never throws.
 * @param {object} booking  inserted booking document
 * @param {string|null} icsContent  ICS text (attached if present)
 */
export async function sendBookingConfirmation(booking, icsContent) {
  const tz = booking.timezone || 'UTC';
  const when = fmt(booking.startTime, tz);
  const attachments = icsContent
    ? [{ filename: 'invite.ics', content: Buffer.from(icsContent, 'utf-8'), contentType: 'text/calendar' }]
    : [];

  const results = { invitee: null, owner: null };

  // Invitee confirmation
  try {
    const html = shell('Your booking is confirmed', [
      row('Event', `${booking.eventTypeTitle} with ${booking.ownerName}`),
      row('When', `${when} <span style="font-weight:400;color:#7A909F;">(${tz})</span>`),
      row('Duration', `${booking.durationMinutes} minutes`),
      booking.location ? row('Location', booking.location) : '',
      booking.notes ? row('Notes', booking.notes) : '',
    ].join(''));

    results.invitee = await sendEmail({
      to: booking.inviteeEmail,
      subject: `Confirmed: ${booking.eventTypeTitle} on ${when}`,
      html,
      text: `Your booking for "${booking.eventTypeTitle}" with ${booking.ownerName} is confirmed for ${when} (${tz}).`,
      type: EMAIL_TYPES?.CUSTOM,
      attachments,
      replyTo: { email: booking.ownerEmail, name: booking.ownerName },
    });
  } catch (e) {
    console.error('Invitee confirmation email failed:', e?.message);
  }

  // Owner notification
  try {
    const html = shell('New booking', [
      row('Event', booking.eventTypeTitle),
      row('Guest', `${booking.inviteeName} (${booking.inviteeEmail})`),
      row('When', `${when} <span style="font-weight:400;color:#7A909F;">(${tz})</span>`),
      row('Duration', `${booking.durationMinutes} minutes`),
      booking.notes ? row('Notes', booking.notes) : '',
    ].join(''));

    results.owner = await sendEmail({
      to: booking.ownerEmail,
      subject: `New booking: ${booking.inviteeName} — ${when}`,
      html,
      text: `${booking.inviteeName} (${booking.inviteeEmail}) booked "${booking.eventTypeTitle}" for ${when} (${tz}).`,
      type: EMAIL_TYPES?.CUSTOM,
      attachments,
      replyTo: { email: booking.inviteeEmail, name: booking.inviteeName },
    });
  } catch (e) {
    console.error('Owner notification email failed:', e?.message);
  }

  return results;
}
