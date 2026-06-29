import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import fs from 'fs';

const mongoUri = "mongodb+srv://admin:fRxLQWKp8wD9GrOl@upcheckresources.fafcx.mongodb.net/?retryWrites=true&w=majority&appName=UpcheckResources";
const botId = "600000000000000000000001";
const imagePath = "D:\\Projects\\upcheck_admin\\upcheck_erp_app\\assets\\upcheck_bot.png";

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("resources");

  if (!fs.existsSync(imagePath)) {
    console.error(`Image file not found at: ${imagePath}`);
    await client.close();
    return;
  }

  console.log('Reading image file...');
  const fileBytes = fs.readFileSync(imagePath);

  console.log('Uploading image to GridFS...');
  const bucket = new GridFSBucket(db);
  const uploadStream = bucket.openUploadStream('upcheck_bot.png', {
    contentType: 'image/png'
  });

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
    uploadStream.end(fileBytes);
  });

  const fileId = uploadStream.id;
  const avatarUrl = `/api/media/${fileId.toString()}`;
  console.log(`Uploaded file ID: ${fileId.toString()}`);
  console.log(`Avatar URL: ${avatarUrl}`);

  console.log('Updating bot user in database...');
  await db.collection('admin_users').updateOne(
    { _id: new ObjectId(botId) },
    { 
      $set: { 
        avatar: avatarUrl 
      } 
    }
  );

  console.log('Bot avatar updated successfully!');
  await client.close();
}

main().catch(console.error);
