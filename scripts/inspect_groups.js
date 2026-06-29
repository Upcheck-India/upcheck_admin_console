import { MongoClient } from 'mongodb';

const mongoUri = "mongodb+srv://admin:fRxLQWKp8wD9GrOl@upcheckresources.fafcx.mongodb.net/?retryWrites=true&w=majority&appName=UpcheckResources";

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("resources");

  const groups = await db.collection('group_chats').find({}).toArray();
  console.log('Group Chats in DB:');
  console.log(JSON.stringify(groups, null, 2));

  const users = await db.collection('admin_users').find({ role: 'bot' }).toArray();
  console.log('Bot Users in DB:');
  console.log(JSON.stringify(users, null, 2));

  await client.close();
}

main().catch(console.error);
