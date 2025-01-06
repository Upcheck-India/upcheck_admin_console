// src/app/api/posts/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";

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
    
    // Generate next ID
    const lastPost = await db.collection('web')
      .find({})
      .sort({ id: -1 })
      .limit(1)
      .toArray();
    
    const nextId = lastPost.length > 0 ? 
      (parseInt(lastPost[0].id) + 1).toString() : 
      "1";
    
    const newPost = {
      ...body,
      id: nextId
    };
    
    const result = await db.collection('web').insertOne(newPost);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}