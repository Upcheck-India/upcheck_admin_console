// src/app/api/documents/route.js
import { NextResponse } from 'next/server';
import { GridFSBucket } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export async function GET(req) {
  const client = await clientPromise;
  const db = client.db('resources');
  const bucket = new GridFSBucket(db);

  try {
    const files = await bucket.find({}).toArray();
    return NextResponse.json(files);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}