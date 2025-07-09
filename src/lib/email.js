import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'upcheck.team@gmail.com',
    pass: process.env.EMAIL_PASS || 'znko yoeq uvbc anvy',
  },
});

/**
 * Sends a styled invitation email.
 */
export const sendEmail = async (to, subject, options) => {
  const { host, event, participants = [], notes } = options;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #4F46E5; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">📩 You're Invited to a meeting!</h1>
      </div>

      <div style="padding: 24px; color: #333333;">
        <p>Hi there,</p>
        <p><strong>${host}</strong> has invited you to a meeting via Upcheck Meetings:</p>

        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #4F46E5;">${event.title}</h2>
          <p><strong>Date:</strong> ${new Date(event.startTime).toLocaleDateString([], { dateStyle: 'full' })}</p>
          <p><strong>Time:</strong> ${new Date(event.startTime).toLocaleTimeString([], { timeStyle: 'short' })}</p>
          <p><strong>Duration:</strong> ${event.duration} minutes</p>
          ${event.description ? `<p style="margin-top: 12px;"><strong>Agenda:</strong><br>${event.description.replace(/\n/g, '<br>')}</p>` : ''}
        </div>

        ${participants.length ? `
          <div style="margin-bottom: 20px;">
            <p><strong>Participants:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              ${participants.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${notes ? `
          <div style="margin-bottom: 20px;">
            <p><strong>Additional Notes:</strong></p>
            <p>${notes.replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${event.zoomMeetingUrl}" style="background-color: #22C55E; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 16px; display: inline-block;">
            Join Meeting
          </a>
        </div>

        <p style="font-size: 14px;">You can view this and other events at <a href="https://erp.upcheck.in/events" style="color: #4F46E5;">Upcheck Console</a>.</p>
        <p style="font-size: 14px;">If you have any questions, feel free to contact the host at <a href="mailto:${host}" style="color: #4F46E5;">${host}</a>.</p>
      </div>

      <div style="background-color: #f3f4f6; color: #6b7280; padding: 16px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">This is an automated notification from Upcheck Admin. Please do not reply directly to this email.</p>
        <div style="margin-top: 10px; display: flex; align-items: center; justify-content: center;">
          <span>Powered by Upcheck + Zoom Meetings</span>
          <img src="https://upload.wikimedia.org/wikipedia/commons/2/2b/Zoom_Communications_Logo.svg" alt="Zoom Logo" style="height: 16px; margin-left: 8px;" />
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `Upcheck Meetings <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw new Error('Failed to send email');
  }
};