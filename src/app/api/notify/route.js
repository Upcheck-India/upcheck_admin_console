import { NextResponse } from 'next/server';
import { sendEmail } from '../../../lib/emailService';

export async function POST(request) {
  try {
    const { to, subject, html, text } = await request.json();

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, and html/text' }, { status: 400 });
    }

    const info = await sendEmail({
      to,
      subject,
      text,
      html: html || text,
      type: 'custom'
    });

    console.log('Email sent successfully via unified service:', info.messageId);

    return NextResponse.json({ message: 'Email sent successfully', info: info.messageId });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}

