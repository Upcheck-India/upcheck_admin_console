import { NextResponse } from 'next/server';
import { ObjectId, GridFSBucket } from 'mongodb';
import { requireAuth, canManageUsers, logActivity } from '../../../../lib/serverAuth';
import { DOCUMENT_CATEGORIES, MAX_DOCUMENT_BYTES } from '../../../../lib/hr/employee';

const BUCKET = 'hr_documents';

// GET - list document metadata. Self sees their own; managers see all and may
// filter by ?employeeId=.
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  const canManage = canManageUsers(user);
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');
  const category = searchParams.get('category');

  const query = {};
  if (canManage) {
    if (employeeId) {
      if (!ObjectId.isValid(employeeId)) {
        return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
      }
      query.employeeId = new ObjectId(employeeId);
    }
  } else {
    query.employeeId = new ObjectId(String(user._id));
  }
  if (category && DOCUMENT_CATEGORIES.includes(category)) query.category = category;

  const documents = await db.collection('employee_documents')
    .find(query).sort({ createdAt: -1 }).limit(1000).toArray();

  return NextResponse.json({ documents, canManage });
}

// POST - upload a document (multipart/form-data: file, category, title, employeeId?)
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { db, user } = auth;

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
  }

  const category = String(form.get('category') || 'other');
  if (!DOCUMENT_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  const title = String(form.get('title') || '').trim();

  // Determine the employee this document belongs to.
  const requestedEmployeeId = form.get('employeeId') ? String(form.get('employeeId')) : String(user._id);
  if (requestedEmployeeId !== String(user._id) && !canManageUsers(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!ObjectId.isValid(requestedEmployeeId)) {
    return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
  }
  const employee = await db.collection('admin_users')
    .findOne({ _id: new ObjectId(requestedEmployeeId) }, { projection: { username: 1, firstName: 1, lastName: 1 } });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = new GridFSBucket(db, { bucketName: BUCKET });
  const fileId = await new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(file.name, { contentType: file.type || 'application/octet-stream' });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id));
    stream.end(buffer);
  });

  const now = new Date();
  const doc = {
    fileId,
    employeeId: new ObjectId(requestedEmployeeId),
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    category,
    title: title || file.name,
    uploadedById: new ObjectId(String(user._id)),
    uploadedByName: user.username,
    createdAt: now,
  };
  const result = await db.collection('employee_documents').insertOne(doc);

  await logActivity(db, {
    action: 'hr.document.upload',
    actor: user,
    targetType: 'user',
    targetId: requestedEmployeeId,
    targetName: doc.employeeName,
    metadata: { category, fileName: file.name },
  });

  return NextResponse.json({ document: { ...doc, _id: result.insertedId } }, { status: 201 });
}
