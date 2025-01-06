// src/app/api/posts/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from 'mongodb';

export async function GET(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const post = await db.collection("web").findOne({ id: params.id });
    
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    
    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const body = await req.json();
    
    // Remove _id from body to prevent immutable field error
    const { _id, ...updateData } = body;
    
    const result = await db.collection("web").updateOne(
      { id: params.id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    const result = await db.collection("web").deleteOne({ id: params.id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}