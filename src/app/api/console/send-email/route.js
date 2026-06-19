import { NextResponse } from 'next/server';
import { sendEmail } from '../../../../lib/emailService';

export async function POST(request) {
  try {
    const { to, subject, html, attachments = [] } = await request.json();

    // Send mail via centralized email service
    const info = await sendEmail({
      to: Array.isArray(to) ? to : [to], // Can send to multiple recipients
      subject: subject,
      html: html,
      attachments: attachments,
      type: 'custom'
    });

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  }
}

