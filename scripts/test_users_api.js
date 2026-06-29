const mongoUri = "mongodb+srv://admin:fRxLQWKp8wD9GrOl@upcheckresources.fafcx.mongodb.net/?retryWrites=true&w=majority&appName=UpcheckResources";
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("resources");

  const query = {};
  const users = await db.collection('admin_users')
    .find(query)
    .project({ password: 0 })
    .toArray();

  console.log('Total users fetched:', users.length);
  console.log('Bot user in fetched list:', users.some(u => u.role === 'bot'));
  console.log('Bot user detail:', users.find(u => u.role === 'bot'));

  await client.close();
}

main().catch(console.error);
