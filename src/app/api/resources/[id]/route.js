// src/app/api/resources/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { ObjectId, GridFSBucket } from 'mongodb';

export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // First, get the resource to find its fileId
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });
    
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }
    
    // Delete from resources collection
    await db.collection('resources').deleteOne({ _id: new ObjectId(id) });
    
    // Delete the file from GridFS if fileId exists
    if (resource.fileId) {
      const bucket = new GridFSBucket(db);
      await bucket.delete(resource.fileId);
    }
    
    return NextResponse.json({ 
      success: true,
      message: "Resource deleted successfully"
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}