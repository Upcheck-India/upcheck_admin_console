import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/surveys/[id]/responses
export async function GET(request, context) {
  try {
    // Extract the survey ID from the URL parameters
    const surveyId = context.params.id;
    console.log('Looking for responses with surveyId:', surveyId);
    
    // Validate the survey ID
    if (!ObjectId.isValid(surveyId)) {
      return NextResponse.json({ error: 'Invalid survey ID' }, { status: 400 });
    }

    // Get user role from headers
    const userRole = request.headers.get('x-user-role');
    
    // Check if user has permission to access survey responses
    if (!userRole || (userRole !== 'Admin' && userRole !== 'Console admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Connect to the database
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Check if the survey exists - try different approaches
    console.log('Attempting to find survey with ID:', surveyId);
    
    // First, try to get all surveys to see what's in the collection
    const allSurveys = await db.collection('surveys').find({}).limit(5).toArray();
    console.log('Sample surveys in database:', JSON.stringify(allSurveys.map(s => ({_id: s._id, title: s.title})), null, 2));
    
    // Try different ways to find the survey
    const surveyWithObjectId = await db.collection('surveys').findOne({ _id: new ObjectId(surveyId) });
    const surveyWithStringId = await db.collection('surveys').findOne({ _id: surveyId });
    
    console.log('Survey found with ObjectId:', !!surveyWithObjectId);
    console.log('Survey found with string ID:', !!surveyWithStringId);
    
    // Use the one that worked
    const survey = surveyWithObjectId || surveyWithStringId;
    console.log('Survey found:', !!survey);
    
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // First, try to get all responses to see what's in the collection
    const allResponses = await db.collection('survey_responses').find({}).limit(10).toArray();
    console.log('All responses in collection:', allResponses.length);
    if (allResponses.length > 0) {
      console.log('Sample response structure:', JSON.stringify(allResponses[0], null, 2));
    }
    
    // Now try to find responses for this specific survey
    const responses = await db.collection('survey_responses').find().toArray();
    
    // Filter responses manually to handle all possible formats
    const filteredResponses = responses.filter(response => {
      // Check all possible formats of surveyId
      if (response.surveyId) {
        // Direct string match
        if (response.surveyId === surveyId) return true;
        
        // ObjectId match (toString)
        if (response.surveyId.toString && response.surveyId.toString() === surveyId) return true;
        
        // MongoDB extended JSON format
        if (response.surveyId.$oid && response.surveyId.$oid === surveyId) return true;
      }
      
      return false;
    });
    
    console.log('Filtered responses count:', filteredResponses.length);
    
    // Return the responses
    return NextResponse.json(filteredResponses);
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    return NextResponse.json({ error: 'Failed to fetch survey responses' }, { status: 500 });
  }
}

// POST /api/surveys/[id]/responses
export async function POST(request, context) {
  try {
    // Extract the survey ID from the URL parameters
    const surveyId = context.params.id;
    
    // Validate the survey ID
    if (!ObjectId.isValid(surveyId)) {
      return NextResponse.json({ error: 'Invalid survey ID' }, { status: 400 });
    }

    // Parse the request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.answers || typeof data.answers !== 'object') {
      return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
    }

    // Connect to the database
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Check if the survey exists and is active
    const survey = await db.collection('surveys').findOne({ 
      _id: new ObjectId(surveyId),
      status: 'active' // Only allow responses for active surveys
    });
    
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found or not active' }, { status: 404 });
    }

    // Check if the survey has a response limit and if it's been reached
    if (survey.settings?.responseLimit > 0) {
      const responseCount = await db.collection('survey_responses').countDocuments({ surveyId: surveyId });
      if (responseCount >= survey.settings.responseLimit) {
        return NextResponse.json({ error: 'Survey response limit reached' }, { status: 400 });
      }
    }

    // Check if the survey has date restrictions
    const now = new Date();
    if (survey.settings?.startDate && new Date(survey.settings.startDate) > now) {
      return NextResponse.json({ error: 'Survey is not yet open for responses' }, { status: 400 });
    }
    if (survey.settings?.endDate && new Date(survey.settings.endDate) < now) {
      return NextResponse.json({ error: 'Survey is closed for responses' }, { status: 400 });
    }

    // Prepare the response object
    const response = {
      surveyId: surveyId,
      answers: data.answers,
      submittedAt: new Date(),
      completionRate: data.completionRate || 1, // Default to 100% complete if not specified
      completionTime: data.completionTime, // Time taken to complete the survey in seconds (optional)
      respondentName: data.respondentName || null,
      respondentEmail: data.respondentEmail || null,
      respondentId: data.respondentId || null, // User ID if authenticated
      userAgent: request.headers.get('user-agent') || null,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    };

    // Insert the response into the database
    const result = await db.collection('survey_responses').insertOne(response);
    
    // Return success response
    return NextResponse.json({
      message: 'Survey response submitted successfully',
      responseId: result.insertedId
    }, { status: 201 });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    return NextResponse.json({ error: 'Failed to submit survey response' }, { status: 500 });
  }
}