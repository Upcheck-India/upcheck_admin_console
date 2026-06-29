import { MongoClient, ObjectId } from 'mongodb';

const mongoUri = "mongodb+srv://admin:fRxLQWKp8wD9GrOl@upcheckresources.fafcx.mongodb.net/?retryWrites=true&w=majority&appName=UpcheckResources";
const userId = "677c0925e4b64d6da65434a4";

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("resources");

  const connections = await db.collection('chat_connections').find({ userId }).toArray();
  console.log('Connections:');
  console.log(JSON.stringify(connections, null, 2));

  const allUsers = await db.collection('admin_users').find({}).toArray();
  console.log('All Users count:', allUsers.length);
  console.log('All Users roles:', allUsers.map(u => ({ username: u.username, role: u.role })));

  await client.close();
}

main().catch(console.error);
