import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    let to = formData.get('to');
    const subject = formData.get('subject');
    const body = formData.get('body');
    
    if (!to || !subject || !body) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Handle multiple recipients
    const recipientEmails = to.split(',').map(e => e.trim()).filter(Boolean);
    if (recipientEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid email recipients provided' },
        { status: 400 }
      );
    }

    // Create reusable transporter object using the default SMTP transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'upcheck.team@gmail.com',
        pass: 'znko yoeq uvbc anvy',
      },
    });

    // Handle attachments
    const attachments = [];
    const attachmentFiles = formData.getAll('attachments');
    
    for (const file of attachmentFiles) {
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        attachments.push({
          filename: file.name,
          content: buffer,
          contentType: file.type
        });
      }
    }

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: 'Upcheck Team <upcheck.team@gmail.com>',
      to: to,
      subject: subject,
      html: body,
      attachments: attachments,
    });

    console.log('Message sent: %s', info.messageId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId 
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}