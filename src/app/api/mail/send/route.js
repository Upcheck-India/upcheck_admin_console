import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';
import { google } from 'googleapis';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('resources');

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user._id.toString();
    const oauth = await db.collection('mail_oauth').findOne({ userId, provider: 'google' });
    if (!oauth || !oauth.tokens || !oauth.tokens.refresh_token) {
      return NextResponse.json({ error: 'Not connected or missing refresh token' }, { status: 412 });
    }

    const formData = await request.formData();
    const to = (formData.get('to') || '').toString();
    const cc = (formData.get('cc') || '').toString();
    const bcc = (formData.get('bcc') || '').toString();
    const subject = (formData.get('subject') || '').toString();
    const body = (formData.get('body') || '').toString();

    const attachments = [];
    const files = formData.getAll('attachments');
    for (const file of files) {
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        attachments.push({ filename: file.name, content: buffer, contentType: file.type });
      }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    
    oauth2Client.setCredentials({
      refresh_token: oauth.tokens.refresh_token,
    });

    // Refresh token
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('Token refreshed successfully');
      
      await db.collection('mail_oauth').updateOne(
        { userId, provider: 'google' },
        { 
          $set: { 
            'tokens.access_token': credentials.access_token,
            'tokens.expiry_date': credentials.expiry_date,
            updatedAt: new Date() 
          } 
        }
      );

      oauth2Client.setCredentials(credentials);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      return NextResponse.json({ 
        error: 'OAuth token refresh failed. Please reconnect.',
        details: refreshError.message 
      }, { status: 401 });
    }

    // Use Gmail API (NOT nodemailer)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Build email message
    const toArr = to ? to.split(',').map(s => s.trim()).filter(Boolean) : [];
    const ccArr = cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : [];
    const bccArr = bcc ? bcc.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    // Validate recipients
    if (toArr.length === 0) {
      return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
    }
    
    let emailMessage = '';
    
    if (attachments.length === 0) {
      // Simple HTML email without attachments
      emailMessage = [
        `From: ${oauth.email || user.email}`,
        `To: ${toArr.join(', ')}`,
        ccArr.length > 0 ? `Cc: ${ccArr.join(', ')}` : '',
        bccArr.length > 0 ? `Bcc: ${bccArr.join(', ')}` : '',
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        body
      ].filter(Boolean).join('\r\n');
    } else {
      // Multipart email with attachments
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const parts = [
        `From: ${oauth.email || user.email}`,
        `To: ${toArr.join(', ')}`,
        ccArr.length > 0 ? `Cc: ${ccArr.join(', ')}` : '',
        bccArr.length > 0 ? `Bcc: ${bccArr.join(', ')}` : '',
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        body,
        ''
      ].filter(Boolean);
      
      // Add attachments
      for (const att of attachments) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
        parts.push('Content-Transfer-Encoding: base64');
        parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        parts.push('');
        
        // Split base64 into 76 character lines (RFC 2045)
        const base64Data = att.content.toString('base64');
        const lines = base64Data.match(/.{1,76}/g) || [];
        parts.push(lines.join('\r\n'));
        parts.push('');
      }
      
      parts.push(`--${boundary}--`);
      emailMessage = parts.join('\r\n');
    }

    // Encode for Gmail API
    const encodedMessage = Buffer.from(emailMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Send via Gmail API
    let result;
    try {
      console.log('Sending email via Gmail API...');
      console.log('To:', toArr);
      console.log('Subject:', subject);
      console.log('Has attachments:', attachments.length > 0);
      
      result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      
      console.log('Email sent successfully via Gmail API:', result.data.id);
    } catch (sendError) {
      console.error('Gmail API send error:', sendError);
      console.error('Error response:', sendError.response?.data);
      
      // Log the first 500 chars of the encoded message for debugging
      console.error('Encoded message sample:', encodedMessage.substring(0, 500));
      
      return NextResponse.json({ 
        error: 'Failed to send email via Gmail API',
        details: sendError.message,
        gmailError: sendError.response?.data?.error
      }, { status: 500 });
    }

    // Save to database
    const now = new Date();
    const messageId = result.data.id;

    const sentDoc = {
      userId,
      folder: 'sent',
      from: oauth.email || user.email,
      fromName: user.name || user.username || user.email,
      to: toArr,
      cc: ccArr,
      bcc: bccArr,
      subject,
      body,
      date: now,
      read: true,
      starred: false,
      hasAttachment: attachments.length > 0,
      attachmentsMeta: attachments.map((a, idx) => ({ 
        filename: a.filename, 
        contentType: a.contentType, 
        index: idx 
      })),
      messageId,
      labels: [],
    };
    await db.collection('emails').insertOne(sentDoc);

    if (attachments.length) {
      const docs = attachments.map((a, idx) => ({
        messageId,
        index: idx,
        filename: a.filename,
        contentType: a.contentType,
        length: a.content?.length || 0,
        data: a.content,
        createdAt: now,
      }));
      await db.collection('email_attachments').insertMany(docs);
    }

    // Internal inbox copies
    const allRecipients = [...toArr, ...ccArr];
    if (allRecipients.length) {
      const internalUsers = await db
        .collection('admin_users')
        .find({ email: { $in: allRecipients } })
        .project({ _id: 1, email: 1 })
        .toArray();
      
      if (internalUsers.length) {
        const inboxDocs = internalUsers.map(r => ({
          userId: r._id.toString(),
          folder: 'inbox',
          from: oauth.email || user.email,
          fromName: user.name || user.username || user.email,
          to: toArr,
          cc: ccArr,
          bcc: [],
          subject,
          body,
          date: now,
          read: false,
          starred: false,
          hasAttachment: attachments.length > 0,
          attachmentsMeta: attachments.map((a, idx) => ({ 
            filename: a.filename, 
            contentType: a.contentType, 
            index: idx 
          })),
          messageId,
          labels: [],
        }));
        await db.collection('emails').insertMany(inboxDocs);
      }
    }

    return NextResponse.json({ success: true, messageId });
  } catch (err) {
    console.error('Mail send (OAuth) error:', err);
    return NextResponse.json({ 
      error: 'Failed to send email',
      details: err.message 
    }, { status: 500 });
  }
}