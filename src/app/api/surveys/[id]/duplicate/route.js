// src/app/api/surveys/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to check admin permissions
const checkAdminPermission = (role) => {
  return role === 'Console admin' || role === 'Admin';
};

// POST - Duplicate a survey
export async function POST(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userRole = request.headers.get('x-user-role');
    const surveyId = params.id;

    // Validate permissions
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized to duplicate surveys' },
        { status: 403 }
      );
    }

    // Check if survey exists
    const existingSurvey = await db.collection('surveys').findOne({ _id: surveyId });
    
    if (!existingSurvey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Generate a new ID for the duplicate survey
    const newSurveyId = new ObjectId().toString();
    
    // Create a duplicate survey with a new ID and updated timestamps
    const duplicateSurvey = {
      ...existingSurvey,
      _id: newSurveyId,
      title: `${existingSurvey.title} (Copy)`,
      status: 'draft', // Always set the duplicate to draft status
      createdAt: new Date(),
      updatedAt: new Date(),
      responseCount: 0
    };

    // Insert the duplicate survey
    await db.collection('surveys').insertOne(duplicateSurvey);

    return NextResponse.json({ 
      message: 'Survey duplicated successfully',
      surveyId: newSurveyId
    });
  } catch (error) {
    console.error('Error duplicating survey:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate survey: ' + error.message },
      { status: 500 }
    );
  }
}
