// src/app/api/resources/[id]/move/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId } from 'mongodb';

export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { projectId } = body;
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db("resources");
    
    // If not moving to general, verify the project exists
    if (projectId !== 'general') {
      const project = await db.collection("projects").findOne({ 
        _id: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId 
      });
      
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    
    // Update the resource with the new project ID
    const result = await db.collection("resources").updateOne(
      { _id: ObjectId.isValid(id) ? new ObjectId(id) : id },
      { 
        $set: { 
          projectId: projectId,
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error moving resource:', error);
    return NextResponse.json({ error: 'Failed to move resource' }, { status: 500 });
  }
}
