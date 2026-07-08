import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

async function run() {
  try {
    const clientPromise = (await import('./src/lib/mongodb.js')).default;
    const client = await clientPromise;
    const db = client.db('resources');
    const { ObjectId } = await import('mongodb');

    const conversationId = "68ff70006f647cdfae14b6eb"; // from connections check
    const currentUserId = "677c0925e4b64d6da65434a4"; // Robin246J

    // Simulate chat/send request body
    const body = "";
    const type = "poll";
    const poll = {
      question: "Which feature to do next?",
      options: [
        { id: "1", text: "Feat A" },
        { id: "2", text: "Feat B" }
      ],
      allowMultiple: true
    };

    // Test send validation logic
    if (!conversationId || (!body?.trim() && type !== 'poll')) {
      console.log('Validation failed!');
    } else {
      console.log('Validation passed!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
