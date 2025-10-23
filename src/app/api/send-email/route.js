import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import clientPromise from '../../../lib/mongodb';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }
    
    let to = formData.get('to');
    let cc = formData.get('cc') || '';
    let bcc = formData.get('bcc') || '';
    const subject = formData.get('subject');
    const body = formData.get('body');
    
    if (!to || !subject || !body) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Handle multiple recipients
    const recipientEmails = (to || '').split(',').map(e => e.trim()).filter(Boolean);
    const ccEmails = (cc || '').split(',').map(e => e.trim()).filter(Boolean);
    const bccEmails = (bcc || '').split(',').map(e => e.trim()).filter(Boolean);
    if (recipientEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid email recipients provided' },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'upcheck.team@gmail.com',
        pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || 'znko yoeq uvbc anvy',
      },
    });

    // Handle attachments
    const attachments = [];
    const attachmentsForDb = [];
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
        attachmentsForDb.push({ filename: file.name, contentType: file.type, length: buffer.length, data: buffer });
      }
    }

    // Send mail
    const fromAddress = `${user.name || user.username || user.email} <${user.email}>`;
    const info = await transporter.sendMail({
      from: fromAddress,
      replyTo: user.email,
      to: recipientEmails,
      cc: ccEmails.length ? ccEmails : undefined,
      bcc: bccEmails.length ? bccEmails : undefined,
      subject: subject,
      html: body,
      attachments: attachments,
    });

    // Save to DB: Sent for sender
    const now = new Date();
    const sentDoc = {
      userId: user._id.toString(),
      folder: 'sent',
      from: user.email,
      fromName: user.name || user.username || user.email,
      to: recipientEmails,
      cc: ccEmails,
      bcc: bccEmails,
      subject,
      body,
      date: now,
      read: true,
      starred: false,
      hasAttachment: attachments.length > 0,
      attachmentsMeta: attachments.map((a, idx) => ({ filename: a.filename, contentType: a.contentType, index: idx })),
      messageId: info.messageId,
      labels: [],
    };
    await db.collection('emails').insertOne(sentDoc);

    // Store attachments for download (single storage by messageId)
    if (attachmentsForDb.length) {
      const docs = attachmentsForDb.map((a, idx) => ({
        messageId: info.messageId,
        index: idx,
        filename: a.filename,
        contentType: a.contentType,
        length: a.length,
        data: a.data,
        createdAt: now,
      }));
      await db.collection('email_attachments').insertMany(docs);
    }

    // Create inbox copies for internal recipients (admin_users)
    const allRecipients = [...recipientEmails, ...ccEmails];
    if (allRecipients.length) {
      const internalUsers = await db
        .collection('admin_users')
        .find({ email: { $in: allRecipients } })
        .project({ _id: 1, email: 1 })
        .toArray();
      const inboxDocs = internalUsers.map(r => ({
        userId: r._id.toString(),
        folder: 'inbox',
        from: user.email,
        fromName: user.name || user.username || user.email,
        to: recipientEmails,
        cc: ccEmails,
        bcc: [],
        subject,
        body,
        date: now,
        read: false,
        starred: false,
        hasAttachment: attachments.length > 0,
        attachmentsMeta: attachments.map((a, idx) => ({ filename: a.filename, contentType: a.contentType, index: idx })),
        messageId: info.messageId,
        labels: [],
      }));
      if (inboxDocs.length) {
        await db.collection('emails').insertMany(inboxDocs);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
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