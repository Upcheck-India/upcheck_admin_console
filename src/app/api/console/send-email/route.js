import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { to, subject, html, attachments = [] } = await request.json();

    // Create reusable transporter object using the default SMTP transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'upcheck.team@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'znko yoeq uvbc anvy',
      },
    });

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"Upcheck Admin" <${process.env.EMAIL_USER || 'upcheck.team@gmail.com'}>`,
      to: Array.isArray(to) ? to : [to], // Can send to multiple recipients
      subject: subject,
      html: html,
      attachments: attachments
    });

    // Save to database here if needed
    
    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
