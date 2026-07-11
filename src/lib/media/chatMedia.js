import { GridFSBucket, ObjectId } from 'mongodb';
import { deleteFromCloudinary } from './cloudinary.js';

// Chat media's `chat_media.files` collection is normally GridFS-managed, but
// a Cloudinary-backed upload writes a compatible document into the same
// collection (see upload-media/route.js) so every existing dedup/ref-count/
// URL-regex-matching code path (chat/send, team-chat/messages,
// group-chats/messages) keeps working unchanged regardless of which
// provider actually stored the bytes. This is the one place that needs to
// know the difference, when the underlying asset is actually deleted.
export async function deleteChatMedia(db, fileId) {
  const _id = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
  const file = await db.collection('chat_media.files').findOne({ _id });
  if (!file) return;

  if (file.metadata?.provider === 'cloudinary') {
    await deleteFromCloudinary(file.metadata.cloudinaryPublicId);
    await db.collection('chat_media.files').deleteOne({ _id });
    return;
  }

  const bucket = new GridFSBucket(db, { bucketName: 'chat_media' });
  await bucket.delete(_id).catch((err) => console.error('GridFS chat media deletion failed:', err));
}
