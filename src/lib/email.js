import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'upcheck.team@gmail.com',
    pass: process.env.EMAIL_PASS || 'znko yoeq uvbc anvy', // It's highly recommended to use environment variables for this
  },
});

/**
 * Sends an email.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {object} options - The options for the email.
 * @param {string} options.host - The host of the event.
 * @param {object} options.event - The event details.
 * @param {string} options.event.title - The title of the event.
 * @param {string} options.event.startTime - The start time of the event.
 * @param {string} options.event.duration - The duration of the event.
 * @param {string} options.event.zoomMeetingUrl - The Zoom meeting URL.
 */
export const sendEmail = async (to, subject, options) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">You're Invited!</h1>
      </div>
      <div style="padding: 20px;">
        <p>Hello,</p>
        <p>You have been invited to the following event by <strong>${options.host}</strong>:</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h2 style="margin-top: 0; font-size: 20px; color: #4F46E5;">${options.event.title}</h2>
          <p><strong>Date:</strong> ${new Date(options.event.startTime).toLocaleDateString([], { dateStyle: 'full' })}</p>
          <p><strong>Time:</strong> ${new Date(options.event.startTime).toLocaleTimeString([], { timeStyle: 'short' })}</p>
          <p><strong>Duration:</strong> ${options.event.duration} minutes</p>
        </div>
        <p style="text-align: center;">
          <a href="${options.event.zoomMeetingUrl}" style="background-color: #22C55E; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">Join Meeting</a>
        </p>
        <p>If you have any questions, please contact the host at <a href="mailto:${options.host}">${options.host}</a>.</p>
      </div>
      <div style="background-color: #f3f4f6; color: #6b7280; padding: 15px; text-align: center; font-size: 12px;">
        <p>This is an automated notification from Upcheck Admin. You do not need to reply to this email.</p>
        <div style="margin-top: 10px; display: inline-block; vertical-align: middle;">
            <span style="vertical-align: middle;">Powered by Zoom Meetings</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 22.5" style="height: 16px; width: auto; margin-left: 6px; vertical-align: middle;">
              <path d="M22.1,0H2.9C1.3,0,0,1.3,0,2.9v16.7C0,21.2,1.3,22.5,2.9,22.5h19.2c1.6,0,2.9-1.3,2.9-2.9V2.9C25,1.3,23.7,0,22.1,0z M10.2,16.2c-1.4,0-2.6-1.1-2.6-2.6s1.1-2.6,2.6-2.6s2.6,1.1,2.6,2.6S11.6,16.2,10.2,16.2z M10.2,8.8c-1.4,0-2.6-1.1-2.6-2.6s1.1-2.6,2.6-2.6s2.6,1.1,2.6,2.6S11.6,8.8,10.2,8.8z M18,16.2c-1.4,0-2.6-1.1-2.6-2.6s1.1-2.6,2.6-2.6s2.6,1.1,2.6,2.6S19.4,16.2,18,16.2z M18,8.8c-1.4,0-2.6-1.1-2.6-2.6s1.1-2.6,2.6-2.6s2.6,1.1,2.6,2.6S19.4,8.8,18,8.8z" fill="#2D8CFF"/>
              <path d="M62.3,10.9c0-3.3-2.2-5.7-6-5.7c-4.1,0-6.4,2.6-6.4,5.9c0,3.1,2.5,5.8,6.5,5.8C60.6,16.9,62.3,14.3,62.3,10.9z M56.3,14.7c-2.1,0-3.5-1.5-3.5-3.7c0-2.3,1.3-3.8,3.4-3.8c2.1,0,3.3,1.5,3.3,3.7C59.5,13.3,58.3,14.7,56.3,14.7z" fill="#2D8CFF"/>
              <path d="M74.9,10.9c0-3.3-2.2-5.7-6-5.7c-4.1,0-6.4,2.6-6.4,5.9c0,3.1,2.5,5.8,6.5,5.8C73.2,16.9,74.9,14.3,74.9,10.9z M68.9,14.7c-2.1,0-3.5-1.5-3.5-3.7c0-2.3,1.3-3.8,3.4-3.8c2.1,0,3.3,1.5,3.3,3.7C72.1,13.3,70.9,14.7,68.9,14.7z" fill="#2D8CFF"/>
              <path d="M88.1,5.4h-3.8v11.3h-2.9V5.4h-3.8V3h10.5V5.4z" fill="#2D8CFF"/>
              <path d="M46.3,5.4h-3.2l-2.9,8.1L37.4,5.4h-3.2v11.3h2.6V7.3l2.8,7.8h2.5l2.8-7.8v9.4h2.6L46.3,5.4L46.3,5.4z" fill="#2D8CFF"/>
              <path d="M98.8,11.3l-3.3-5.9h2.9l1.9,4l1.9-4h2.9l-3.3,5.9v5.4h-2.9V11.3z" fill="#2D8CFF"/>
            </svg>
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `Upcheck Admin <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
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
