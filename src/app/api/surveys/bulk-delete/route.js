// src/app/api/surveys/bulk-delete/route.js
import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

// Helper function to check admin permissions
const checkAdminPermission = (role) => {
  return role === 'Console admin' || role === 'Admin';
};

// POST - Bulk delete surveys
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const { ids } = await request.json();
    const userRole = request.headers.get('x-user-role');

    // Validate permissions
    if (!checkAdminPermission(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete surveys' },
        { status: 403 }
      );
    }

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: ids must be a non-empty array' },
        { status: 400 }
      );
    }

    // Delete the surveys
    const result = await db.collection('surveys').deleteMany({
      _id: { $in: ids }
    });

    // Delete all responses associated with these surveys
    await db.collection('survey_responses').deleteMany({
      surveyId: { $in: ids }
    });

    return NextResponse.json({ 
      message: 'Surveys deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting surveys:', error);
    return NextResponse.json(
      { error: 'Failed to delete surveys: ' + error.message },
      { status: 500 }
    );
  }
}
