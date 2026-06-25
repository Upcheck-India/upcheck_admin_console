import clientPromise from './src/lib/mongodb.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

async function run() {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const users = await db.collection('admin_users').find({}, { projection: { username: 1, email: 1, firstName: 1, lastName: 1 } }).toArray();
    console.log('Users in DB:');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
