// src/app/api/posts/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const posts = await db.collection('web').find({}).toArray();
    return NextResponse.json(posts);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const body = await req.json();

    const newPost = {
      ...body,
      id: uuidv4(), // Generate unique UUID
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('web').insertOne(newPost);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}