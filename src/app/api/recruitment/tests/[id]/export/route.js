import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const client = await clientPromise;
    const db = client.db("resources");

    const test = await db.collection('test_attempts').findOne({
      _id: new ObjectId(id)
    });

    if (!test) {
      return NextResponse.json(
        { message: 'Test not found' },
        { status: 404 }
      );
    }

    // Convert test data to CSV format
    const csvHeaders = ['Question', 'Answer', 'Type'];
    const csvRows = test.answers.map(a => [
      a.question.replace(/"/g, '""'), // Escape quotes in questions
      a.answer.replace(/"/g, '""'),   // Escape quotes in answers
      a.type || 'text'
    ]);

    // Add metadata rows at the top
    const metadataRows = [
      ['Test Results Summary'],
      ['Applicant Name', test.applicantName],
      ['Applicant ID', test.applicantId],
      ['Role', test.role],
      ['Score', `${test.score}%`],
      ['Time Spent', `${Math.floor(test.timeSpent / 60)}m ${test.timeSpent % 60}s`],
      ['Submitted At', new Date(test.submittedAt).toLocaleString()],
      ['']  // Empty row before questions
    ];

    const csvContent = [
      ...metadataRows,
      csvHeaders,
      ...csvRows
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Create response with CSV content
    const response = new NextResponse(csvContent);
    response.headers.set('Content-Type', 'text/csv');
    response.headers.set('Content-Disposition', `attachment; filename="test-results-${id}.csv"`);
    
    return response;
  } catch (error) {
    console.error('Error exporting test:', error);
    return NextResponse.json(
      { message: 'Failed to export test results' },
      { status: 500 }
    );
  }
}