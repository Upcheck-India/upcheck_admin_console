// src/app/api/surveys/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to check admin permissions
const checkAdminPermission = (role) => {
  return role === 'Console admin' || role === 'Admin';
};

// GET - Fetch all surveys
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const userRole = req.headers.get('x-user-role');

    // Only admin users can access surveys
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    const surveys = await db.collection('surveys')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // For each survey, count the number of responses
    const surveysWithResponseCount = await Promise.all(surveys.map(async (survey) => {
      const responseCount = await db.collection('survey_responses')
        .countDocuments({ surveyId: survey._id.toString() });
      
      return {
        ...survey,
        responseCount
      };
    }));

    return NextResponse.json(surveysWithResponseCount);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys: ' + error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new survey
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const data = await request.json();
    const userRole = request.headers.get('x-user-role');

    // Validate permissions
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized to create surveys' },
        { status: 403 }
      );
    }

    // Generate a unique survey ID
    const surveyId = new ObjectId().toString();

    const newSurvey = {
      _id: surveyId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: data.status || 'draft',
      responseCount: 0
    };

    await db.collection('surveys').insertOne(newSurvey);

    return NextResponse.json({ 
      message: 'Survey created successfully',
      surveyId: surveyId
    });
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json(
      { error: 'Failed to create survey: ' + error.message },
      { status: 500 }
    );
  }
}
