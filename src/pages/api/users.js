import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req, res) {
  try {
    const { method } = req;
    const { db } = await connectToDatabase();
    const collection = db.collection('admin_users');

    if (method === 'GET') {
      const users = await collection.find({}).toArray();
      return res.status(200).json(users);
    }

    if (method === 'POST') {
      const { username, password, role, department } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      await collection.insertOne({ username, password, role, department });
      return res.status(201).json({ message: 'User created successfully' });
    }

    if (method === 'PUT') {
      const { id, ...updateData } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      await collection.updateOne({ _id: id }, { $set: updateData });
      return res.status(200).json({ message: 'User updated successfully' });
    }

    if (method === 'DELETE') {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      await collection.deleteOne({ _id: id });
      return res.status(200).json({ message: 'User deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/users:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
