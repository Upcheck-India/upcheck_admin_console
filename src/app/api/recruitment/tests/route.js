// src/app/api/recruitment/tests/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { v4 as uuidv4 } from 'uuid';

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("recruitment");
    const tests = await db.collection('tests').find({}).toArray();
    return NextResponse.json(tests);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const client = await clientPromise;
    const db = client.db("recruitment");
    const body = await req.json();

    const newTest = {
      ...body,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: body.status || 'draft',
      candidates: [],
      submissions: 0
    };

    const result = await db.collection('tests').insertOne(newTest);
    return NextResponse.json(newTest);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
