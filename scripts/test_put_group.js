import { MongoClient, ObjectId } from 'mongodb';

const mongoUri = "mongodb+srv://admin:fRxLQWKp8wD9GrOl@upcheckresources.fafcx.mongodb.net/?retryWrites=true&w=majority&appName=UpcheckResources";

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("resources");

  const groupId = "6a3fd57e51b498accd8cb7ed";
  const group = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });

  console.log('Original members:', group.members);
  
  // Try adding a member
  const newMemberId = "600000000000000000000001"; // Bot ID
  const members = [...(group.members || []), newMemberId].map(id => {
    try { return new ObjectId(id); } catch { return id; }
  });

  const updateResult = await db.collection('group_chats').updateOne(
    { _id: new ObjectId(groupId) },
    { $set: { members } }
  );

  console.log('Update result:', updateResult);

  const updatedGroup = await db.collection('group_chats').findOne({ _id: new ObjectId(groupId) });
  console.log('Updated members:', updatedGroup.members);

  await client.close();
}

main().catch(console.error);
