import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env.local' });

async function run() {
  try {
    const { default: clientPromise } = await import('../src/lib/mongodb.js');
    const client = await clientPromise;
    const db = client.db('resources');
    console.log('Querying collections...');
    
    // Query Robin246J in admin_users
    const user = await db.collection('admin_users').findOne({ username: 'Robin246J' });
    console.log('User Robin246J document:');
    console.log(JSON.stringify(user, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
