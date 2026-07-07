import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { ObjectId } from 'mongodb';
import { isValidDisplayMode, isAdminRole } from '../../../../lib/changelogs';

// PUT /api/changelogs/[id] — update fields and/or toggle publish (admin only).
// Publishing (isPublished false -> true) stamps a fresh publishedAt so the
// "unseen" check treats it as newly surfaced even if it was edited long after
// creation.
export async function PUT(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid changelog ID' }, { status: 400 });
    }
    const changelogId = new ObjectId(id);

    const existing = await db.collection('changelogs').findOne({ _id: changelogId });
    if (!existing) {
      return NextResponse.json({ error: 'Changelog not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, body: content, version, displayMode, publish } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    }
    if (!isValidDisplayMode(displayMode)) {
      return NextResponse.json({ error: 'Invalid displayMode' }, { status: 400 });
    }

    const isPublished = !!publish;
    const updatedFields = {
      title: title.trim(),
      body: content.trim(),
      version: version ? String(version).trim() : '',
      displayMode,
      isPublished,
      updatedAt: new Date(),
    };
    // Newly published (wasn't before) — reset publishedAt so it surfaces as
    // "new" to everyone, including users who'd already seen an earlier draft.
    if (isPublished && !existing.isPublished) {
      updatedFields.publishedAt = new Date();
    }

    await db.collection('changelogs').updateOne({ _id: changelogId }, { $set: updatedFields });

    return NextResponse.json({ success: true, changelog: { ...existing, ...updatedFields } });
  } catch (error) {
    console.error('Error updating changelog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/changelogs/[id] (admin only)
export async function DELETE(request, { params }) {
  try {
    const authData = await getAuthUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = authData;

    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid changelog ID' }, { status: 400 });
    }
    const changelogId = new ObjectId(id);

    const result = await db.collection('changelogs').deleteOne({ _id: changelogId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Changelog not found' }, { status: 404 });
    }

    // Clean up seen-tracking for the deleted entry so it doesn't accumulate
    // orphaned rows.
    await db.collection('changelog_seen').deleteMany({ changelogId: id }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting changelog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
