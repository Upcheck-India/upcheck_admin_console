import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logAudit, AUDIT_ACTIONS } from '../../../../../lib/dataroom/audit-logger';
import { withDataroomAuth } from '../../../../../lib/dataroom/withDataroomAuth';
import { storeDocumentStream } from '../../../../../lib/dataroom/document-storage';
import {
  accessibleProjects,
  documentationBucket,
  readableResources,
  unimportableReason,
} from '../../../../../lib/dataroom/documentation-bridge';

const MAX_PER_REQUEST = 25;

/**
 * GET /api/dataroom/import/documentation
 *
 * Browse what this user could import. With no `projectId` it lists the
 * Documentation projects they can see; with one it lists that project's
 * folders and the files inside it they are allowed to read.
 *
 * selfScoped: the result set is bounded by Documentation's own permission
 * rules, not by a data room grant — this endpoint reads the other module, and
 * the data room resource does not exist yet.
 */
export const GET = withDataroomAuth(
  async (request, { user, db }) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const folderId = searchParams.get('folderId');

    if (!projectId) {
      return NextResponse.json({ projects: await accessibleProjects(db, user) });
    }

    if (projectId !== 'general' && !ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }

    const scope = { projectId, isDeleted: { $ne: true } };
    if (folderId && folderId !== 'null') {
      if (!ObjectId.isValid(folderId)) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
      }
      scope.folderId = new ObjectId(folderId);
    }

    const [folders, resources] = await Promise.all([
      db
        .collection('doc_folders')
        .find({ projectId, isDeleted: { $ne: true } })
        .project({ name: 1, parentId: 1 })
        .limit(200)
        .toArray(),
      db.collection('resources').find(scope).limit(300).toArray(),
    ]);

    // Files that cannot be imported are listed with the reason rather than
    // hidden, so the picker can grey them out and say why instead of leaving
    // someone hunting for a file they can plainly see in Documentation.
    const files = (await readableResources(db, user, resources)).map((r) => ({
      _id: r._id,
      name: r.name,
      fileType: r.fileType,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      folderId: r.folderId,
      currentVersion: r.currentVersion,
      updatedAt: r.updatedAt,
      unimportableReason: unimportableReason(r),
    }));

    return NextResponse.json({ folders, files, count: files.length });
  },
  { selfScoped: true },
);

/**
 * POST /api/dataroom/import/documentation
 *
 * Body: { roomId, folderId?, resourceIds: [] }
 *
 * The `edit` grant on the destination room is enforced by the wrapper. Read
 * access to each source file is enforced per file below — see the note at the
 * top of lib/dataroom/documentation-bridge.js for why both halves are
 * necessary and why this copies rather than links.
 */
export const POST = withDataroomAuth(
  async (request, { user, db }) => {
    const body = await request.json();
    const { roomId, folderId, resourceIds } = body;

    if (!roomId || !ObjectId.isValid(roomId)) {
      return NextResponse.json({ error: 'Valid roomId is required' }, { status: 400 });
    }

    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json({ error: 'resourceIds required' }, { status: 400 });
    }

    if (resourceIds.length > MAX_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_PER_REQUEST} files can be imported at once` },
        { status: 400 },
      );
    }

    const validIds = resourceIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (!validIds.length) {
      return NextResponse.json({ error: 'No valid resourceIds' }, { status: 400 });
    }

    const room = await db
      .collection('dataroom_rooms')
      .findOne({ _id: new ObjectId(roomId), isDeleted: { $ne: true } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    let targetFolderId = null;
    if (folderId && folderId !== 'null') {
      if (!ObjectId.isValid(folderId)) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
      }
      const folder = await db.collection('dataroom_folders').findOne({
        _id: new ObjectId(folderId),
        roomId: new ObjectId(roomId),
        isDeleted: { $ne: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      targetFolderId = new ObjectId(folderId);
    }

    const resources = await db
      .collection('resources')
      .find({ _id: { $in: validIds }, isDeleted: { $ne: true } })
      .toArray();

    // The permission gate. Anything the caller may not read in Documentation
    // simply is not in this list, and is reported as skipped below.
    const allowed = await readableResources(db, user, resources);
    const allowedIds = new Set(allowed.map((r) => r._id.toString()));

    const bucket = documentationBucket(db);
    const imported = [];
    const skipped = resourceIds
      .filter((id) => !allowedIds.has(String(id)))
      .map((id) => ({ resourceId: String(id), reason: 'not readable, missing, or deleted' }));

    // Index numbers are allocated once for the batch rather than re-read per
    // file, so twenty imports do not each take the same number.
    const [lastDoc] = await db
      .collection('dataroom_documents')
      .find({ roomId: new ObjectId(roomId) })
      .sort({ indexNumber: -1 })
      .limit(1)
      .toArray();
    let nextIndex = (lastDoc?.indexNumber || 0) + 1;

    for (const resource of allowed) {
      const blocked = unimportableReason(resource);
      if (blocked) {
        skipped.push({ resourceId: resource._id.toString(), reason: blocked });
        continue;
      }

      try {
        const stored = await db
          .collection('fs.files')
          .findOne({ _id: resource.fileId }, { projection: { length: 1, contentType: 1 } });

        if (!stored) {
          skipped.push({
            resourceId: resource._id.toString(),
            reason: 'source file is missing from storage',
          });
          continue;
        }

        const mimeType = resource.mimeType || stored.contentType || 'application/octet-stream';
        const fileName = resource.name || 'document';

        const storage = await storeDocumentStream(
          db,
          bucket.openDownloadStream(resource.fileId),
          { filename: fileName, contentType: mimeType, roomId: new ObjectId(roomId), user },
        );

        const newDocument = {
          roomId: new ObjectId(roomId),
          folderId: targetFolderId,
          name: fileName,
          description: '',
          documentType: 'document',
          indexNumber: nextIndex,
          ...storage,
          fileName,
          fileSize: stored.length,
          mimeType,
          metadata: { tags: [] },
          currentVersion: 1,
          state: 'published',
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          isDeleted: false,
          // Provenance, so the room can say where a document came from and a
          // later "re-import the current version" can find its way back. It is
          // a record of origin, not a live link: the copy is independent, and
          // deliberately so.
          source: {
            module: 'documentation',
            resourceId: resource._id,
            projectId: resource.projectId,
            versionAtImport: resource.currentVersion || 1,
            importedAt: new Date(),
            importedBy: { id: user._id.toString(), email: user.email },
          },
          createdAt: new Date(),
          createdBy: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
          },
          updatedAt: new Date(),
        };

        const result = await db.collection('dataroom_documents').insertOne(newDocument);
        nextIndex += 1;

        await db.collection('dataroom_versions').insertOne({
          documentId: result.insertedId,
          versionNumber: 1,
          ...storage,
          fileName,
          fileSize: stored.length,
          mimeType,
          createdAt: new Date(),
          createdBy: newDocument.createdBy,
          changeNote: `Imported from Documentation (v${resource.currentVersion || 1})`,
        });

        await db.collection('dataroom_permissions').insertOne({
          resourceType: 'document',
          resourceId: result.insertedId.toString(),
          roomId: roomId.toString(),
          userId: user._id.toString(),
          userEmail: user.email,
          groupId: null,
          permissions: ['admin'],
          expiresAt: null,
          grantedBy: { id: user._id.toString(), email: user.email },
          grantedAt: new Date(),
          updatedAt: new Date(),
        });

        imported.push({ _id: result.insertedId, name: fileName, sourceId: resource._id });
      } catch (error) {
        console.error('Documentation import failed:', error);
        skipped.push({
          resourceId: resource._id.toString(),
          reason: 'could not be copied into storage',
        });
      }
    }

    // One audit entry for the batch, naming what actually landed. Auditing per
    // file would bury a twenty-file import in twenty near-identical rows.
    await logAudit({
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      resourceType: 'room',
      resourceId: new ObjectId(roomId),
      roomId: new ObjectId(roomId),
      user,
      details: {
        via: 'documentation-import',
        requested: resourceIds.length,
        imported: imported.map((d) => d.name),
        skipped: skipped.length,
      },
      request,
    });

    return NextResponse.json(
      { imported, skipped, count: imported.length },
      { status: imported.length ? 201 : 200 },
    );
  },
  {
    requires: 'edit',
    // The destination room arrives in the JSON body; read a clone so the
    // handler can still consume the request stream itself.
    resolve: async (request) => {
      const body = await request.clone().json().catch(() => ({}));
      return body?.roomId ? { type: 'room', id: String(body.roomId) } : null;
    },
  },
);
