import dotenv from 'dotenv';
import path from 'path';

// MUST be called before importing anything that uses database
dotenv.config({ path: path.resolve('.env.local') });

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

async function run() {
  // Dynamically import to ensure dotenv executes first
  const { triggerBotAgent } = await import('./src/lib/botAgent.js');

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('resources');
    
    // Find robin@upcheck.in user
    const user = await db.collection('admin_users').findOne({ email: 'robin@upcheck.in' });
    if (!user) {
      console.error("User robin@upcheck.in not found");
      return;
    }

    // Find DM conversation
    const conversation = await db.collection('conversations').findOne({
      participants: user._id.toString()
    });
    if (!conversation) {
      console.error("No conversation found");
      return;
    }

    console.log(`Triggering bot with message: "See the past meetings. There will be some meetings named test or testing"`);
    console.log(`Chat ID: ${conversation._id.toString()}`);

    await triggerBotAgent({
      chatType: 'dm',
      chatId: conversation._id.toString(),
      body: "See the past meetings. There will be some meetings named test or testing",
      currentUser: user,
      db
    });

    console.log("Completed triggerBotAgent execution.");
    
    // Fetch last message from chat_messages
    const lastMsg = await db.collection('chat_messages')
      .find({ conversationId: conversation._id.toString() })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (lastMsg.length > 0) {
      console.log("\nLast Bot Response in DB:");
      console.log(`Body: "${lastMsg[0].body}"`);
      console.log(`Status: ${lastMsg[0].status}`);
      console.log(`Type: ${lastMsg[0].type}`);
    }
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await client.close();
  }
}
run();
