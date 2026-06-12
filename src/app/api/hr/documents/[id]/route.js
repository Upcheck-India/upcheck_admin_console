import { NextResponse } from 'next/server';
import { ObjectId, GridFSBucket } from 'mongodb';
import { requireAuth, canManageUsers, logActivity } from '../../../../../lib/serverAuth';

const BUCKET = 'hr_documents';

async function loadDoc(db, id) {
  if (!ObjectId.isValid(id)) return null;
  return db.collection('employee_documents').findOne({ _id: new ObjectId(id) });
}

function canAccess(user, doc) {
  if (!doc) return false;
  if (canManageUsers(user)) return true;
  return String(doc.employeeId) === String(user._id);
}

// GET - stream/download the file. ?inline=1 displays in-browser instead of downloading.
export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const doc = await loadDoc(db, params.id);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (!canAccess(user, doc)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const inline = searchParams.get('inline') === '1';

  const bucket = new GridFSBucket(db, { bucketName: BUCKET });
  const files = await bucket.find({ _id: doc.fileId }).toArray();
  if (!files.length) return NextResponse.json({ error: 'File data missing' }, { status: 404 });

  const stream = bucket.openDownloadStream(doc.fileId);
  const disposition = inline ? 'inline' : 'attachment';
  return new NextResponse(stream, {
    headers: {
      'Content-Type': doc.contentType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`,
      'Content-Length': String(doc.size || files[0].length),
    },
  });
}

// DELETE - remove the metadata + underlying GridFS file.
export async function DELETE(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const doc = await loadDoc(db, params.id);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (!canAccess(user, doc)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const bucket = new GridFSBucket(db, { bucketName: BUCKET });
  try {
    await bucket.delete(doc.fileId);
  } catch {
    // File chunk already gone; proceed to remove metadata regardless.
  }
  await db.collection('employee_documents').deleteOne({ _id: doc._id });

  await logActivity(db, {
    action: 'hr.document.delete',
    actor: user,
    targetType: 'user',
    targetId: String(doc.employeeId),
    targetName: doc.employeeName,
    metadata: { fileName: doc.fileName, category: doc.category },
  });

  return NextResponse.json({ success: true });
}
