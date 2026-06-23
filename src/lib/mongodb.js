// src/lib/mongodb.js
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

if (!global.mongoose) {
  global.mongoose = mongoose;
}

if (!process.env.MONGODB_URI) {

  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
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

// Mongoose connection management
export async function connectToDatabase() {
  // Check if already connected
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    if (!mongoose.connection.db) {
      mongoose.connection.db = mongoose.connection.useDb('resources').db;
    }
    return mongoose.connection;
  }

  // If currently connecting, wait for it to complete
  if (mongoose.connection.readyState === 2) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => {
        if (!mongoose.connection.db) {
          mongoose.connection.db = mongoose.connection.useDb('resources').db;
        }
        resolve(mongoose.connection);
      });
      mongoose.connection.once('error', reject);
    });
  }

  try {
    await mongoose.connect(uri, {
      dbName: 'resources',
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    
    if (!mongoose.connection.db) {
      mongoose.connection.db = mongoose.connection.useDb('resources').db;
    }
    console.log('Connected to MongoDB with Mongoose (dbName: resources)');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

export default clientPromise;