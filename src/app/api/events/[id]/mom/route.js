import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { GridFSBucket, ObjectId } from 'mongodb';
import { getUserFromToken } from '../../../../../lib/eventAuthHelper';
import { scanFile } from '../../../../../lib/dataroom/virus-scanner';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_EXTENSIONS = ['pdf', 'docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Local magic number check for PDF and DOCX
function validateFileSignature(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    // PDF signature: %PDF (25 50 44 46)
    if (buffer.length < 4) return false;
    const header = buffer.toString('hex', 0, 4);
    return header === '25504446';
  } else if (ext === 'docx') {
    // ZIP signature: PK\x03\x04 (50 4b 03 04)
    if (buffer.length < 4) return false;
    const header = buffer.toString('hex', 0, 4);
    return header === '504b0304';
  }
  
  return false;
}

// GET /api/events/[id]/mom?fileId=...
// Downloads/streams a specific MOM document
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileIdStr = searchParams.get('fileId');

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    if (!fileIdStr || !ObjectId.isValid(fileIdStr)) {
      return NextResponse.json({ error: 'Valid file ID is required' }, { status: 400 });
    }

    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Retrieve event details to check if the user is a participant or host
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify access: host or participant (case-insensitive checks)
    const userEmailLower = user.email.toLowerCase();
    const hostEmailLower = (event.host || '').toLowerCase();
    const participantEmailsLower = (event.participants || []).map(p => (p || '').toLowerCase());
    
    const isParticipantOrHost = userEmailLower === hostEmailLower || participantEmailsLower.includes(userEmailLower);
    
    if (!isParticipantOrHost) {
      return NextResponse.json({ error: 'Forbidden. You are not a participant or host of this event.' }, { status: 403 });
    }

    // Ensure the file is part of this event's momDocuments
    const momDocs = event.momDocuments || [];
    const hasMomDoc = momDocs.some(doc => doc.fileId.toString() === fileIdStr);
    if (!hasMomDoc) {
      return NextResponse.json({ error: 'MOM document not found for this event' }, { status: 404 });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'event_moms' });
    const fileId = new ObjectId(fileIdStr);

    const filesCursor = bucket.find({ _id: fileId });
    const files = await filesCursor.toArray();
    
    if (!files.length) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }
    
    const file = files[0];
    
    // Download the file
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(fileId);
    
    await new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', (err) => reject(err));
      downloadStream.on('end', () => resolve());
    });
    
    const fileBuffer = Buffer.concat(chunks);
    
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    headers.set('Content-Type', file.contentType || 'application/octet-stream');
    headers.set('Content-Length', fileBuffer.length.toString());
    
    return new NextResponse(fileBuffer, { 
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Failed to download MOM:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/events/[id]/mom
// Uploads a MOM document for the event
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Fetch event and verify permissions
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const userEmailLower = user.email.toLowerCase();
    const hostEmailLower = (event.host || '').toLowerCase();
    const participantEmailsLower = (event.participants || []).map(p => (p || '').toLowerCase());
    
    const isParticipantOrHost = userEmailLower === hostEmailLower || participantEmailsLower.includes(userEmailLower);
    
    if (!isParticipantOrHost) {
      return NextResponse.json({ error: 'Forbidden. Only participants or the host can upload MOMs.' }, { status: 403 });
    }

    // Limit MOM documents count to max 3
    const currentMoms = event.momDocuments || [];
    if (currentMoms.length >= 3) {
      return NextResponse.json({ error: 'Maximum limit of 3 MOM documents reached for this meeting' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 1. Validate file size (Max 5MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds the 5MB limit' }, { status: 400 });
    }

    // 2. Validate file type by extension
    const filename = file.name || 'document';
    const ext = filename.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Only PDF and DOCX files are allowed' }, { status: 400 });
    }

    // 3. Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file MIME type. Only PDF and DOCX files are allowed.' }, { status: 400 });
    }

    // Read file bytes for signature and scanning
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Local signature/magic number check
    const isSignatureValid = validateFileSignature(buffer, filename);
    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Security verification failed. File signature does not match its extension.' }, { status: 400 });
    }

    // 5. Antivirus/security scanning
    const scanResult = await scanFile(file, filename);
    if (!scanResult.safe) {
      console.warn('MOM file rejected by security scan:', scanResult.threatLabels);
      return NextResponse.json({
        error: 'File blocked by antivirus scan',
        threats: scanResult.threatLabels || []
      }, { status: 403 });
    }

    // Upload to GridFS bucket "event_moms"
    const bucket = new GridFSBucket(db, { bucketName: 'event_moms' });
    const fileId = new ObjectId();
    
    const uploadStream = bucket.openUploadStreamWithId(fileId, filename, {
      contentType: file.type,
      metadata: {
        eventId: id,
        uploadedBy: user.email,
        uploadedAt: new Date()
      }
    });

    await new Promise((resolve, reject) => {
      uploadStream.write(buffer);
      uploadStream.end();
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    // Save details to the event document
    const momDoc = {
      _id: new ObjectId(),
      fileId: fileId,
      filename: filename,
      contentType: file.type,
      size: file.size,
      uploadedBy: user.email,
      uploadedAt: new Date()
    };

    await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { $push: { momDocuments: momDoc } }
    );

    return NextResponse.json({
      message: 'MOM document uploaded successfully',
      mom: momDoc
    }, { status: 200 });

  } catch (error) {
    console.error('Failed to upload MOM:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/events/[id]/mom?fileId=...
// Deletes a specific MOM document
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileIdStr = searchParams.get('fileId');

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    if (!fileIdStr || !ObjectId.isValid(fileIdStr)) {
      return NextResponse.json({ error: 'Valid file ID is required' }, { status: 400 });
    }

    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Locate the MOM document inside the event
    const momDocs = event.momDocuments || [];
    const momDoc = momDocs.find(doc => doc.fileId.toString() === fileIdStr);
    
    if (!momDoc) {
      return NextResponse.json({ error: 'MOM document not found' }, { status: 404 });
    }

    // Check permissions: event host or the user who uploaded the file
    const isHost = user.email.toLowerCase() === (event.host || '').toLowerCase();
    const isUploader = user.email.toLowerCase() === (momDoc.uploadedBy || '').toLowerCase();

    if (!isHost && !isUploader) {
      return NextResponse.json({ error: 'Forbidden. Only the host or the uploader can delete this MOM.' }, { status: 403 });
    }

    // 1. Remove from database event momDocuments array
    await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { $pull: { momDocuments: { fileId: new ObjectId(fileIdStr) } } }
    );

    // 2. Delete from GridFS bucket "event_moms"
    const bucket = new GridFSBucket(db, { bucketName: 'event_moms' });
    try {
      await bucket.delete(new ObjectId(fileIdStr));
    } catch (fsErr) {
      console.warn('Warning: File not found in GridFS during delete:', fsErr.message);
      // Proceed even if missing in file system to avoid stuck database records
    }

    return NextResponse.json({ message: 'MOM document deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete MOM:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
