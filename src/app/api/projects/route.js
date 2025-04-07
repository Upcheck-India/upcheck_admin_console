// src/app/api/projects/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from 'mongodb';

// GET - Fetch all projects
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    const projects = await db.collection("projects").find({}).toArray();
    
    // Ensure there's always a general project in the response
    const hasGeneral = projects.some(project => project._id === 'general' || project.name.toLowerCase() === 'general');
    
    if (!hasGeneral) {
      // Add general project to the beginning of the array
      projects.unshift({
        _id: 'general',
        name: 'General',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST - Create a new project
export async function POST(req) {
  try {
    const body = await req.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Check if a project with the same name already exists
    const existingProject = await db.collection("projects").findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingProject) {
      return NextResponse.json({ error: 'A project with this name already exists' }, { status: 409 });
    }
    
    // Create new project
    const project = {
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection("projects").insertOne(project);
    
    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...project
    });
    
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
