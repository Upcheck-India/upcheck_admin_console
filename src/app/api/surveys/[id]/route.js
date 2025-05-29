// src/app/api/surveys/[id]/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to check admin permissions
const checkAdminPermission = (role) => {
  return role === 'Console admin' || role === 'Admin';
};

// Helper function to find a survey by ID (trying both string and ObjectId)
async function findSurveyById(db, surveyId) {
  // First try with string ID
  let survey = await db.collection('surveys').findOne({ _id: surveyId });
  
  // If not found, try with ObjectId
  if (!survey) {
    try {
      survey = await db.collection('surveys').findOne({ _id: new ObjectId(surveyId) });
    } catch (err) {
      console.log('Error converting to ObjectId:', err.message);
    }
  }
  
  return survey;
}

// GET - Fetch a specific survey by ID
export async function GET(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userRole = request.headers.get('x-user-role');
    const surveyId = params.id;

    // Only admin users can access surveys
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // Try both string ID and ObjectId for MongoDB lookup
    console.log('Looking for survey with ID:', surveyId);
    const survey = await findSurveyById(db, surveyId);
    console.log('Survey found:', !!survey);
    
    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Add response count to the survey data
    const responseCount = await db.collection('survey_responses').countDocuments({
      $or: [
        { surveyId: surveyId },
        { 'surveyId.$oid': surveyId }
      ]
    });

    return NextResponse.json({
      ...survey,
      responseCount
    });
  } catch (error) {
    console.error('Error fetching survey:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey: ' + error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a survey
export async function PUT(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');
    const surveyId = params.id;

    // Validate permissions
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized to update surveys' },
        { status: 403 }
      );
    }

    // Check if survey exists
    const existingSurvey = await findSurveyById(db, surveyId);
    
    if (!existingSurvey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    // Remove _id from update data if present
    if (updateData._id) {
      delete updateData._id;
    }

    // Update using the same ID format as the existing survey
    const result = await db.collection('surveys').updateOne(
      { _id: existingSurvey._id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Survey updated successfully',
      surveyId: surveyId
    });
  } catch (error) {
    console.error('Error updating survey:', error);
    return NextResponse.json(
      { error: 'Failed to update survey: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a survey
export async function DELETE(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userRole = request.headers.get('x-user-role');
    const surveyId = params.id;

    // Validate permissions
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete surveys' },
        { status: 403 }
      );
    }

    // Check if survey exists
    const existingSurvey = await findSurveyById(db, surveyId);
    
    if (!existingSurvey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Delete the survey using the same ID format as the existing survey
    const result = await db.collection('surveys').deleteOne({ _id: existingSurvey._id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to delete survey' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Survey deleted successfully',
      surveyId: surveyId
    });
  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json(
      { error: 'Failed to delete survey: ' + error.message },
      { status: 500 }
    );
  }
}