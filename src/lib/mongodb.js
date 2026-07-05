// src/lib/mongodb.js
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Automatically clear stale bot locks on startup/restart
clientPromise.then(async (resolvedClient) => {
  try {
    const db = resolvedClient.db('resources');
    await Promise.all([
      db.collection('conversations').updateMany({ isBotProcessing: true }, { $set: { isBotProcessing: false }, $unset: { botProcessingStartedAt: "" } }),
      db.collection('group_chats').updateMany({ isBotProcessing: true }, { $set: { isBotProcessing: false }, $unset: { botProcessingStartedAt: "" } }),
      db.collection('teams').updateMany({ isBotProcessing: true }, { $set: { isBotProcessing: false }, $unset: { botProcessingStartedAt: "" } })
    ]);
  } catch (err) {
    console.error('Failed to clear stale bot processing locks on startup:', err);
  }
}).catch(() => {});

// Ensure messaging indexes exist (idempotent, runs once per process, fire-and-
// forget so it never blocks the first request). Auth previously did an
// unindexed COLLSCAN of admin_sessions/admin_users on EVERY request, and
// team/group message + typing + mute queries had no index at all and scanned
// growing collections on every 2s poll. createIndex is a no-op when the index
// already exists.
clientPromise.then(async (resolvedClient) => {
  try {
    const db = resolvedClient.db('resources');
    await Promise.all([
      // Auth — hit on every single API request
      db.collection('admin_sessions').createIndex({ token: 1 }),
      db.collection('admin_users').createIndex({ sessionToken: 1 }, { sparse: true }),
      // Message reads/polls
      db.collection('chat_messages').createIndex({ conversationId: 1, createdAt: -1 }),
      db.collection('team_messages').createIndex({ teamId: 1, createdAt: 1 }),
      db.collection('group_chat_messages').createIndex({ groupId: 1, createdAt: 1 }),
      // Optimization indexes for unread count polling
      db.collection('chat_messages').createIndex({ conversationId: 1, recipientId: 1, status: 1 }),
      db.collection('group_chat_messages').createIndex({ groupId: 1, 'readBy.userId': 1 }),
      db.collection('team_messages').createIndex({ teamId: 1, 'readBy.userId': 1 }),
      // Idempotency dedupe by clientId
      db.collection('team_messages').createIndex({ clientId: 1 }, { sparse: true }),
      db.collection('group_chat_messages').createIndex({ clientId: 1 }, { sparse: true }),
      // Typing (polled every cycle)
      db.collection('dm_typing').createIndex({ conversationId: 1, updatedAt: 1 }),
      db.collection('team_typing').createIndex({ teamId: 1, updatedAt: 1 }),
      db.collection('group_typing').createIndex({ groupId: 1, updatedAt: 1 }),
      // Mute lookups on send + poll
      db.collection('chat_mutes').createIndex({ chatId: 1, chatType: 1 }),
      db.collection('chat_mutes').createIndex({ userId: 1, chatType: 1 }),
      // Connections list
      db.collection('chat_connections').createIndex({ userId: 1, status: 1 }),
    ]);
  } catch (err) {
    console.error('Failed to ensure messaging indexes on startup:', err);
  }
}).catch(() => {});

// Mongoose connection management
export async function connectToDatabase() {
  if (global.mongoose.conn) {
    return global.mongoose.conn.connection;
  }

  if (!global.mongoose.promise) {
    const opts = {
      dbName: 'resources',
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    global.mongoose.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('Connected to MongoDB with Mongoose (dbName: resources)');
      return mongoose;
    }).catch(err => {
      console.error('MongoDB connection error:', err);
      global.mongoose.promise = null;
      throw err;
    });
  }

  global.mongoose.conn = await global.mongoose.promise;
  return global.mongoose.conn.connection;
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  global.mongoose.promise = null;
  global.mongoose.conn = null;
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
  global.mongoose.promise = null;
  global.mongoose.conn = null;
});

export default clientPromise;